import type { APIRoute } from "astro";
import { processGuidedAnswer } from "@/lib/project/guided-engine";
import { isValidBriefPatch, type ProjectBrief } from "@/lib/project/schema";

export const prerender = false;

const rateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 25;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow"
    }
  });
}

export const GET: APIRoute = async () => {
  const hasOpenAI = Boolean(String(import.meta.env.OPENAI_API_KEY || "").trim());
  const hasGemini = Boolean(String(import.meta.env.GEMINI_API_KEY || "").trim());
  const hasMail = Boolean(String(import.meta.env.RESEND_API_KEY || "").trim());

  return json({
    assistantMode: hasOpenAI || hasGemini ? "ai" : "guided",
    aiProvider: hasOpenAI ? "openai" : hasGemini ? "gemini" : null,
    submissionConnected: hasMail
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "local";

    if (checkRateLimit(ip)) {
      return json(
        {
          ok: false,
          code: "rate_limited",
          message: "Recibimos muchas solicitudes seguidas. Espera un momento o continúa en modo guiado."
        },
        429
      );
    }

    const body = (await request.json().catch(() => null)) as {
      brief?: ProjectBrief;
      stepId?: string;
      answer?: string;
      isSelection?: boolean;
    } | null;

    if (!body || !body.brief || typeof body.answer !== "string") {
      return json({ ok: false, code: "invalid_payload", message: "Solicitud incompleta." }, 400);
    }

    const answer = body.answer.trim().slice(0, 1200);
    const stepId = String(body.stepId || "summary").slice(0, 40);

    // Deterministic guided fallback is always computed as baseline safety
    const guidedTurn = processGuidedAnswer(body.brief, stepId, answer, Boolean(body.isSelection));

    const openAiKey = String(import.meta.env.OPENAI_API_KEY || "").trim();
    if (!openAiKey) {
      return json({ ok: true, ...guidedTurn });
    }

    // Optional AI Provider path (only when OPENAI_API_KEY is explicitly configured in server env)
    try {
      const model = String(import.meta.env.OPENAI_MODEL || "gpt-4o-mini").trim();
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content:
                "Eres el Asistente de proyectos ENIX Studio. Responde solo en JSON válido con las claves: interpretation (string breve en español), question (string, una pregunta clara). Nunca inventes precios, fechas cerradas ni prometas generación automática de software."
            },
            {
              role: "user",
              content: JSON.stringify({
                stage: guidedTurn.stage,
                briefTitle: body.brief.title,
                category: body.brief.category,
                userAnswer: answer,
                nextGuidedQuestion: guidedTurn.question
              })
            }
          ]
        })
      });

      if (response.ok) {
        const data = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const rawContent = data.choices?.[0]?.message?.content;
        if (rawContent) {
          const parsed = JSON.parse(rawContent) as { interpretation?: string; question?: string };
          if (
            typeof parsed.interpretation === "string" &&
            typeof parsed.question === "string" &&
            isValidBriefPatch(guidedTurn.patch)
          ) {
            return json({
              ok: true,
              ...guidedTurn,
              mode: "ai",
              interpretation: parsed.interpretation.slice(0, 320),
              question: parsed.question.slice(0, 320)
            });
          }
        }
      }
    } catch {
      // Fall back transparently to guidedTurn without losing user input
    }

    return json({ ok: true, ...guidedTurn });
  } catch {
    return json(
      {
        ok: false,
        code: "server_error",
        message: "No pudimos procesar el turno en el servidor. Puedes continuar en modo guiado local."
      },
      500
    );
  }
};
