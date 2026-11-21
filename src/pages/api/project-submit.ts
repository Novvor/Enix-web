import type { APIRoute } from "astro";
import { briefToPlainText } from "@/lib/project/export";
import type { ProjectBrief } from "@/lib/project/schema";
import { siteConfig } from "@/content/site";

export const prerender = false;

const RESEND_API_URL = "https://api.resend.com/emails";
const idempotencyCache = new Map<string, { referenceId: string; createdAt: number }>();
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

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

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  record.count += 1;
  return record.count > 6;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "local";

    if (isRateLimited(ip)) {
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
      brief?: ProjectBrief;
      contact?: { name?: string; email?: string; company?: string; role?: string; phone?: string };
    } | null;

    if (!body) {
      return json({ ok: false, code: "invalid_payload", message: "Datos inválidos." }, 400);
    }

    if (sanitize(body.honeypot, 100)) {
      return json({ ok: false, code: "spam_detected", message: "No pudimos procesar la solicitud." }, 400);
    }

    const name = sanitize(body.name ?? body.contact?.name, 140);
    const email = sanitize(body.email ?? body.contact?.email, 180);
    const company = sanitize(body.company ?? body.contact?.company, 140);
    const role = sanitize(body.role ?? body.contact?.role, 120);
    const phone = sanitize(body.phone ?? body.contact?.phone, 60);
    const notes = sanitize(body.notes, 2000);
    const idempotencyKey = sanitize(body.idempotencyKey, 80);

    if (!name || name.length < 2) {
      return json({ ok: false, code: "invalid_name", message: "Ingresa tu nombre." }, 400);
    }

    if (!email || !isValidEmail(email)) {
      return json({ ok: false, code: "invalid_email", message: "Ingresa un correo electrónico válido." }, 400);
    }

    // Idempotency protection: prevent duplicate sends on double-click or retry
    if (idempotencyKey) {
      const existing = idempotencyCache.get(idempotencyKey);
      if (existing && Date.now() - existing.createdAt < 30 * 60_000) {
        return json({
          ok: true,
          deduplicated: true,
          referenceId: existing.referenceId,
          message: "Esta solicitud ya fue recibida anteriormente."
        });
      }
    }

    const resendApiKey = String(import.meta.env.RESEND_API_KEY || "").trim();
    const toEmail = String(import.meta.env.CONTACT_TO_EMAIL || siteConfig.contactEmail).trim();
    const fromEmail = String(import.meta.env.CONTACT_FROM_EMAIL || "onboarding@resend.dev").trim();

    if (!resendApiKey) {
      return json(
        {
          ok: false,
          code: "missing_mail_config",
          message:
            "La recepción directa requiere configurar RESEND_API_KEY en el servidor. Puedes descargar tu resumen o abrirlo en tu correo."
        },
        503
      );
    }

    const referenceId = `ENIX-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const summaryText = body.brief ? briefToPlainText(body.brief) : notes;

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;background:#FAF8F6;padding:24px;color:#301B3C;">
        <div style="max-width:640px;margin:0 auto;background:#FFFFFF;border:1px solid rgba(48,27,60,0.12);border-radius:16px;padding:28px;">
          <p style="font-size:12px;color:#B92F0E;font-weight:700;text-transform:uppercase;margin:0 0 8px;">Referencia ${escapeHtml(referenceId)}</p>
          <h1 style="font-size:22px;margin:0 0 16px;">Nueva ficha de proyecto — ${escapeHtml(name)}</h1>
          <p style="margin:4px 0;"><strong>Correo:</strong> ${escapeHtml(email)}</p>
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
        html
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
      idempotencyCache.set(idempotencyKey, { referenceId, createdAt: Date.now() });
    }

    return json({
      ok: true,
      referenceId,
      deliveryStatus: "accepted_by_mail_provider",
      providerMessageId,
      message: `Tu ficha fue enviada al servicio de correo para el equipo de ENIX Studio (referencia ${referenceId}). Conserva una copia o descarga tu ficha si deseas respaldo local.`
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
