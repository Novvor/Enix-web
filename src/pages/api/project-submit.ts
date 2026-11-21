import type { APIRoute } from "astro";
import { briefToPlainText } from "@/lib/project/export";
import { computeBriefReadiness, type ProjectBrief } from "@/lib/project/schema";
import { getRedisClient } from "@/lib/redis";
import { siteConfig } from "@/content/site";

export const prerender = false;

const RESEND_API_URL = "https://api.resend.com/emails";
const idempotencyCache = new Map<string, { referenceId: string; createdAt: number }>();
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

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

function sanitize(value: unknown, maxLen = 500): string {
  return String(value ?? "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLen);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

async function checkSubmitRateLimit(ip: string): Promise<boolean> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const key = `enix:submit:rate:${ip}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, 60);
      return count > 5;
    } catch {
      // Fall through to local memory guard if Redis temporarily fails
    }
  }
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  record.count += 1;
  return record.count > 5;
}

async function getIdempotentReference(key: string): Promise<string | null> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const val = await redis.get<string>(`enix:submit:idem:${key}`);
      if (typeof val === "string" && val) return val;
    } catch {
      // fall through
    }
  }
  const existing = idempotencyCache.get(key);
  if (existing && Date.now() - existing.createdAt < 30 * 60_000) {
    return existing.referenceId;
  }
  return null;
}

async function saveIdempotentReference(key: string, referenceId: string): Promise<void> {
  idempotencyCache.set(key, { referenceId, createdAt: Date.now() });
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.set(`enix:submit:idem:${key}`, referenceId, { ex: 1800 });
    } catch {
      // non-fatal
    }
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!isAllowedOrigin(request)) {
      return json({ ok: false, code: "forbidden_origin", message: "Origen no autorizado." }, 403);
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "local";

    if (await checkSubmitRateLimit(ip)) {
      return json(
        {
          ok: false,
          code: "rate_limited",
          message: "Recibimos demasiados intentos seguidos. Espera un minuto e inténtalo nuevamente."
        },
        429
      );
    }

    const body = (await request.json().catch(() => null)) as {
      name?: string;
      email?: string;
      company?: string;
      role?: string;
      phone?: string;
      notes?: string;
      honeypot?: string;
      idempotencyKey?: string;
      quickContact?: boolean;
      sourcePage?: string;
      brief?: ProjectBrief;
      conversationExcerpt?: Array<{ role?: string; text?: string }>;
      contact?: { name?: string; email?: string; company?: string; role?: string; phone?: string };
    } | null;

    if (!body) {
      return json({ ok: false, code: "invalid_payload", message: "Datos inválidos." }, 400);
    }

    if (sanitize(body.honeypot, 100)) {
      return json({ ok: false, code: "spam_detected", message: "No pudimos procesar la solicitud." }, 400);
    }

    const isQuickContact = Boolean(body.quickContact);
    const rawName = sanitize(body.name ?? body.contact?.name, 140);
    const name = rawName || (isQuickContact ? "Visitante web" : "");
    const email = sanitize(body.email ?? body.contact?.email, 180);
    const company = sanitize(body.company ?? body.contact?.company, 140);
    const role = sanitize(body.role ?? body.contact?.role, 120);
    const phone = sanitize(body.phone ?? body.contact?.phone, 60);
    const notes = sanitize(body.notes, 2000);
    const sourcePage = sanitize(body.sourcePage, 120);
    const idempotencyKey = sanitize(body.idempotencyKey, 80);

    if (!isQuickContact && (!name || name.length < 2)) {
      return json({ ok: false, code: "invalid_name", message: "Ingresa tu nombre." }, 400);
    }

    if (!email || !isValidEmail(email)) {
      return json({ ok: false, code: "invalid_email", message: "Ingresa un correo electrónico válido." }, 400);
    }

    // Distributed idempotency protection: prevent duplicate sends on double-click or retry
    if (idempotencyKey) {
      const existingRef = await getIdempotentReference(idempotencyKey);
      if (existingRef) {
        return json({
          ok: true,
          deduplicated: true,
          referenceId: existingRef,
          deliveryStatus: "accepted_by_mail_provider",
          message: `Esta solicitud ya fue recibida anteriormente (referencia ${existingRef}).`
        });
      }
    }

    const resendApiKey = String(
      import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY || ""
    ).trim();
    const toEmail = String(
      import.meta.env.CONTACT_TO_EMAIL || process.env.CONTACT_TO_EMAIL || siteConfig.contactEmail
    ).trim();
    const fromEmail = String(
      import.meta.env.CONTACT_FROM_EMAIL || process.env.CONTACT_FROM_EMAIL || "onboarding@resend.dev"
    ).trim();

    if (!resendApiKey) {
      return json(
        {
          ok: false,
          code: "missing_mail_config",
          message:
            "El canal de envío directo no está disponible en este entorno. Puedes descargar tu ficha o escribirnos a hello@enix.studio."
        },
        503
      );
    }

    const referenceId = `ENIX-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const readiness = body.brief ? computeBriefReadiness(body.brief) : null;
    const baseSummary = body.brief ? briefToPlainText(body.brief) : notes;
    const pendingSection =
      readiness && readiness.toClarify.length > 0
        ? `\n\n--- Información pendiente por aclarar con el cliente ---\n- ${readiness.toClarify.join("\n- ")}`
        : "";
    const excerptLines = Array.isArray(body.conversationExcerpt)
      ? body.conversationExcerpt
          .slice(-10)
          .map((item) => {
            const who = item?.role === "Steve" || item?.role === "assistant" ? "Steve" : "Visitante";
            const txt = sanitize(item?.text, 400);
            return txt ? `[${who}]: ${txt}` : "";
          })
          .filter(Boolean)
      : [];
    const conversationSection =
      excerptLines.length > 0
        ? `\n\n--- Contexto de la conversación con Steve ---\n${excerptLines.join("\n\n")}`
        : "";
    const summaryText =
      `${baseSummary}${pendingSection}${conversationSection}`.trim() ||
      "Solicitud rápida desde el chat (sin ficha ampliada aún).";

    const internalHtml = `
      <div style="font-family:Inter,Arial,sans-serif;background:#FAF8F6;padding:24px;color:#301B3C;">
        <div style="max-width:640px;margin:0 auto;background:#FFFFFF;border:1px solid rgba(48,27,60,0.12);border-radius:16px;padding:28px;">
          <p style="font-size:12px;color:#B92F0E;font-weight:700;text-transform:uppercase;margin:0 0 8px;">Referencia ${escapeHtml(referenceId)}${isQuickContact ? " · Contacto rápido desde Steve" : ""}</p>
          <h1 style="font-size:22px;margin:0 0 16px;">${isQuickContact ? "Solicitud de contacto rápido" : "Nueva ficha de proyecto"} — ${escapeHtml(name)}</h1>
          <p style="margin:4px 0;"><strong>Correo:</strong> ${escapeHtml(email)}</p>
          ${sourcePage ? `<p style="margin:4px 0;"><strong>Página de origen:</strong> ${escapeHtml(sourcePage)}</p>` : ""}
          ${company ? `<p style="margin:4px 0;"><strong>Empresa:</strong> ${escapeHtml(company)}</p>` : ""}
          ${role ? `<p style="margin:4px 0;"><strong>Cargo:</strong> ${escapeHtml(role)}</p>` : ""}
          ${phone ? `<p style="margin:4px 0;"><strong>Teléfono:</strong> ${escapeHtml(phone)}</p>` : ""}
          <hr style="border:none;border-top:1px solid rgba(48,27,60,0.12);margin:20px 0;" />
          <pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;line-height:1.6;margin:0;">${escapeHtml(summaryText)}</pre>
        </div>
      </div>
    `;

    const resendRes = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: email,
        subject: `[ENIX Studio] Ficha ${referenceId} — ${name}`,
        html: internalHtml
      })
    });

    if (!resendRes.ok) {
      return json(
        {
          ok: false,
          code: "provider_error",
          message: "El proveedor de correo rechazó el envío temporalmente. Intenta de nuevo o descarga tu resumen."
        },
        502
      );
    }

    const resendData = (await resendRes.json().catch(() => null)) as { id?: string } | null;
    const providerMessageId = typeof resendData?.id === "string" ? resendData.id : null;

    if (idempotencyKey) {
      await saveIdempotentReference(idempotencyKey, referenceId);
    }

    // Non-blocking visitor confirmation receipt when sending from a verified domain
    let confirmationSent = false;
    if (!fromEmail.toLowerCase().includes("resend.dev")) {
      try {
        const receiptHtml = `
          <div style="font-family:Inter,Arial,sans-serif;background:#FAF8F6;padding:24px;color:#301B3C;">
            <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid rgba(48,27,60,0.12);border-radius:16px;padding:28px;">
              <p style="font-size:12px;color:#B92F0E;font-weight:700;text-transform:uppercase;margin:0 0 8px;">ENIX Studio · Referencia ${escapeHtml(referenceId)}</p>
              <h1 style="font-size:20px;margin:0 0 12px;">Recibimos tu solicitud, ${escapeHtml(name)}</h1>
              <p style="font-size:14px;line-height:1.6;color:#5D5164;margin:0 0 16px;">
                Nuestro equipo revisará el detalle de tu proyecto para responderte con una evaluación clara de alcance y próximos pasos.
              </p>
              <p style="font-size:13px;color:#65596C;margin:0;">
                Si necesitas agregar información adicional, puedes responder directamente a este correo o escribir a <a href="mailto:${escapeHtml(siteConfig.contactEmail)}" style="color:#B92F0E;font-weight:700;">${escapeHtml(siteConfig.contactEmail)}</a> indicando la referencia <strong>${escapeHtml(referenceId)}</strong>.
              </p>
            </div>
          </div>
        `;
        const receiptRes = await fetch(RESEND_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [email],
            reply_to: toEmail,
            subject: `Recibimos tu solicitud en ENIX Studio (${referenceId})`,
            html: receiptHtml
          })
        });
        confirmationSent = receiptRes.ok;
      } catch {
        confirmationSent = false;
      }
    }

    return json({
      ok: true,
      referenceId,
      deliveryStatus: "accepted_by_mail_provider",
      providerMessageId,
      confirmationSent,
      message: confirmationSent
        ? `Recibimos tu solicitud (referencia ${referenceId}) y enviamos un acuse a tu correo. El equipo de ENIX Studio revisará tu proyecto y te responderá pronto.`
        : `Tu solicitud fue recibida para el equipo de ENIX Studio (referencia ${referenceId}). Conserva este código o descarga tu ficha como respaldo.`
    });
  } catch {
    return json(
      {
        ok: false,
        code: "server_error",
        message: "No pudimos completar el envío en este momento."
      },
      500
    );
  }
};
