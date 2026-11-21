import type { APIRoute } from "astro";
import {
  LIMITS,
  handleAssistantTurn,
  resolveOrCreateSession,
  type ProviderInvoker
} from "@/lib/server/assistant-guard";
import { resolveRuntimeCoordinator } from "@/lib/server/production-store";
import type { CommercialStage, ProjectBrief } from "@/lib/project/schema";

export const prerender = false;

const ALLOWED_ORIGINS = [
  "https://www.enix.studio",
  "https://enix.studio",
  "http://localhost:4321",
  "http://localhost:4322",
  "http://127.0.0.1:4322"
];

function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/enix-[a-z0-9-]+-danifronters-projects\.vercel\.app$/.test(origin)) {
    return true;
  }
  return false;
}

function json(data: unknown, status = 200, setCookieHeader: string | null = null) {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "private, no-store",
    "x-robots-tag": "noindex, nofollow"
  };
  if (setCookieHeader) {
    headers["set-cookie"] = setCookieHeader;
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function isAiEnabledByEnv(): boolean {
  const flag = String(
    import.meta.env.ASSISTANT_AI_ENABLED ?? process.env.ASSISTANT_AI_ENABLED ?? "true"
  )
    .trim()
    .toLowerCase();
  return flag !== "false" && flag !== "0" && flag !== "off";
}

function createOpenAiInvoker(apiKey: string): ProviderInvoker {
  return async ({ systemPrompt, userPayload, model, maxTokens, signal }) => {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        temperature: 0.35,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPayload }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        completion_tokens_details?: { reasoning_tokens?: number };
      };
    };
    const rawJson = data.choices?.[0]?.message?.content;
    if (!rawJson) throw new Error("Empty OpenAI response");

    return {
      rawJson,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
      reasoningTokens: data.usage?.completion_tokens_details?.reasoning_tokens ?? 0
    };
  };
}

function createGeminiInvoker(apiKey: string): ProviderInvoker {
  return async ({ systemPrompt, userPayload, model, maxTokens, signal }) => {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPayload }] }],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: maxTokens,
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        thoughtsTokenCount?: number;
      };
    };
    const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) throw new Error("Empty Gemini response");

    return {
      rawJson,
      inputTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
      reasoningTokens: data.usageMetadata?.thoughtsTokenCount ?? 0
    };
  };
}

export const GET: APIRoute = async ({ request }) => {
  const openAiKey = String(import.meta.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || "").trim();
  const geminiKey = String(import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "").trim();
  const hasMail = Boolean(String(import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY || "").trim());

  const storeResolution = resolveRuntimeCoordinator(import.meta.env as Record<string, unknown>);
  const canRunAi =
    isAiEnabledByEnv() &&
    Boolean(openAiKey || geminiKey) &&
    (!storeResolution.isProduction || storeResolution.sharedStoreConfigured);

  const sessionSecret = String(
    import.meta.env.ASSISTANT_SESSION_SECRET || process.env.ASSISTANT_SESSION_SECRET || ""
  );
  const { setCookieHeader } = resolveOrCreateSession(request, sessionSecret);

  return json(
    {
      assistantMode: canRunAi ? "ai" : "guided",
      aiProvider: canRunAi ? (openAiKey ? "openai" : "gemini") : null,
      sharedStoreReady: storeResolution.sharedStoreConfigured,
      submissionConnected: hasMail,
      maxMessageChars: LIMITS.maxMessageChars
    },
    200,
    setCookieHeader
  );
};

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!isAllowedOrigin(request)) {
      return json({ ok: false, code: "forbidden_origin", message: "Origen no autorizado." }, 403);
    }

    const sessionSecret = String(
      import.meta.env.ASSISTANT_SESSION_SECRET || process.env.ASSISTANT_SESSION_SECRET || ""
    );
    const { sessionId, setCookieHeader } = resolveOrCreateSession(request, sessionSecret);

    const body = (await request.json().catch(() => null)) as {
      brief?: ProjectBrief;
      stepId?: string;
      answer?: string;
      message?: string;
      pageId?: string;
      requestId?: string;
      isSelection?: boolean;
      conversationMode?: "commercial" | "legacy-guided";
      history?: Array<{ role: "user" | "assistant"; text: string }>;
      currentCommercialStage?: CommercialStage;
    } | null;

    const rawText = typeof body?.message === "string" ? body.message : body?.answer;

    if (!body || !body.brief || typeof rawText !== "string") {
      return json(
        { ok: false, code: "invalid_payload", message: "Solicitud incompleta." },
        400,
        setCookieHeader
      );
    }

    const openAiKey = String(import.meta.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || "").trim();
    const geminiKey = String(import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "").trim();
    const aiEnabled = isAiEnabledByEnv();

    const storeResolution = resolveRuntimeCoordinator(import.meta.env as Record<string, unknown>);

    const providerName = openAiKey ? "openai" : geminiKey ? "gemini" : null;
    const model =
      providerName === "openai"
        ? String(import.meta.env.OPENAI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini").trim()
        : String(import.meta.env.GEMINI_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();

    const providerInvoker =
      providerName === "openai"
        ? createOpenAiInvoker(openAiKey)
        : providerName === "gemini"
          ? createGeminiInvoker(geminiKey)
          : undefined;

    const safeHistory = Array.isArray(body.history)
      ? body.history
          .slice(-6)
          .filter(
            (m): m is { role: "user" | "assistant"; text: string } =>
              Boolean(m && typeof m === "object" && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
          )
      : [];

    const result = await handleAssistantTurn({
      sessionId,
      requestId: typeof body.requestId === "string" ? body.requestId : "",
      brief: body.brief,
      answer: rawText,
      stepId: body.stepId,
      pageId: body.pageId,
      isSelection: Boolean(body.isSelection),
      conversationMode: body.conversationMode || "commercial",
      history: safeHistory,
      currentCommercialStage: body.currentCommercialStage,
      aiEnabled,
      isProduction: storeResolution.isProduction,
      providerName,
      model,
      coordinator: storeResolution.coordinator,
      providerInvoker
    });

    return json(result.body, result.httpStatus, setCookieHeader);
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
