import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyBrief,
  createInitialLeadCapture,
  normalizeLeadCapture,
  type LeadCaptureState
} from "../src/lib/project/schema.ts";
import { applyBriefPatch } from "../src/lib/project/state.ts";
import { processCommercialTurn } from "../src/lib/project/guided-engine.ts";
import {
  InMemoryCoordinatorStore,
  handleAssistantTurn
} from "../src/lib/server/assistant-guard.ts";
import {
  isValidClientEmail,
  submitInlineContact
} from "../src/lib/project/assistant-client.ts";

test("1. 'Quiero un CRM': recomendación concreta (sin relleno), 1 descubrimiento breve y captura de contacto en turno 2", () => {
  let brief = createEmptyBrief("", null, "development");
  let lead: LeadCaptureState = createInitialLeadCapture();

  const t1 = processCommercialTurn(brief, "Quiero un CRM", {
    pageId: "/",
    history: [],
    leadCapture: lead
  });
  assert.doesNotMatch(t1.interpretation, /muy potente|gran oportunidad/i, "Sin frases vacías");
  assert.match(t1.interpretation, /partir[ií]a con|comenzar por|permitir[ií]a/i, "Recomendación concreta primero");
  assert.equal(t1.askedDiscoveryQuestion, true);
  assert.equal(t1.offerContact, false);

  brief = applyBriefPatch(brief, t1.patch);
  lead = { ...lead, discoveryQuestionsAsked: lead.discoveryQuestionsAsked + 1 };

  const t2 = processCommercialTurn(brief, "Priorizar gestión de clientes y pipeline de ventas", {
    pageId: "/",
    isSelection: true,
    history: [
      { role: "user", text: "Quiero un CRM" },
      { role: "assistant", text: t1.reply || "" }
    ],
    leadCapture: lead
  });
  assert.equal(t2.offerContact, true, "Debe ofrecer contacto tras 1 pregunta de descubrimiento");
  assert.match(t2.question, /a qu[eé] correo puede escribirte el equipo de enix/i);
});

test("2. 'Quiero cotizar una web': contacto disponible inmediatamente en el mismo turno", () => {
  const brief = createEmptyBrief("", null, "development");
  const t1 = processCommercialTurn(brief, "Quiero cotizar una web", {
    pageId: "/",
    history: [],
    leadCapture: createInitialLeadCapture()
  });
  assert.equal(t1.offerContact, true, "Debe ofrecer contacto de inmediato ante intención de cotizar");
  assert.equal(t1.commercialStage, "evaluation");
  assert.match(t1.interpretation, /sitio web|partir[ií]a/i);
});

test("3. 'Necesito más clientes': enfoque comercial concreto sin enumerar todo el catálogo", () => {
  const brief = createEmptyBrief("", null, "development");
  const t1 = processCommercialTurn(brief, "Necesito más clientes", {
    pageId: "/",
    history: [],
    leadCapture: createInitialLeadCapture()
  });
  const wordCount = t1.interpretation.split(/\s+/).filter(Boolean).length;
  assert.ok(wordCount <= 55, `Demasiado largo (${wordCount} palabras): ${t1.interpretation}`);
  assert.match(t1.interpretation, /campa[nñ]as|captaci[oó]n|honorarios/i);
  assert.doesNotMatch(t1.interpretation, /sitios web.*aplicaciones.*sistemas.*automatizaciones.*ia/i);
});

test("4. Mensaje inicial detallado: aprovecha los datos y ofrece contacto directo sin preguntas redundantes", () => {
  const brief = createEmptyBrief("", null, "development");
  const detailed =
    "Tengo una peluquería en Ñuñoa con 4 estilistas, hoy recibimos reservas por WhatsApp y queremos una web con reservas online y abonos en 2 meses";
  const t1 = processCommercialTurn(brief, detailed, {
    pageId: "/",
    history: [],
    leadCapture: createInitialLeadCapture()
  });
  assert.equal(t1.offerContact, true, "Con contexto detallado debe ofrecer contacto directo");
  assert.equal(t1.commercialStage, "evaluation");
  assert.equal(t1.patch.declaredTimeline, "en 2 meses");
});

test("5. Correo entregado espontáneamente: lo reconoce sin volver a pedirlo y prepara el envío", () => {
  const brief = createEmptyBrief("", null, "development");
  const t1 = processCommercialTurn(
    brief,
    "Necesito ordenar pedidos en Excel, escríbanme a camila.silva@gmail.com",
    {
      pageId: "/",
      history: [],
      leadCapture: createInitialLeadCapture()
    }
  );
  assert.equal(t1.detectedEmail, "camila.silva@gmail.com");
  assert.equal(t1.offerContact, true);
  assert.match(t1.interpretation, /camila\.silva@gmail\.com/);
  assert.doesNotMatch(t1.question, /a qu[eé] correo/i, "No debe volver a pedir el correo que ya dio");
});

test("6. Contacto rechazado: sigue ayudando sin volver a insistir (ni en guiado ni en modo IA)", async () => {
  const brief = createEmptyBrief("Quiero un CRM", "management-systems", "development");
  const tDecline = processCommercialTurn(brief, "Ahora no, prefiero seguir conversando", {
    pageId: "/",
    history: [{ role: "user", text: "Quiero un CRM" }],
    leadCapture: { ...createInitialLeadCapture(), discoveryQuestionsAsked: 1, status: "offered" }
  });
  assert.equal(tDecline.contactDeclined, true);
  assert.equal(tDecline.offerContact, false);

  const declinedLead: LeadCaptureState = {
    ...createInitialLeadCapture(),
    discoveryQuestionsAsked: 2,
    status: "declined"
  };

  // Incluso si el modelo IA intentara devolver offerContact: true, el servidor lo bloquea
  const coord = new InMemoryCoordinatorStore();
  const aiRes = await handleAssistantTurn({
    sessionId: "sess-declined-1",
    requestId: "req-declined-1",
    brief,
    answer: "¿Cómo se conectaría con WhatsApp?",
    pageId: "/",
    history: [{ role: "user", text: "Quiero un CRM" }],
    leadCapture: declinedLead,
    aiEnabled: true,
    isProduction: false,
    providerName: "openai",
    model: "gpt-4o-mini",
    coordinator: coord,
    providerInvoker: async () => ({
      rawJson: JSON.stringify({
        onTopic: true,
        interpretation: "Podríamos evaluar conectar el CRM con WhatsApp Business API para registrar consultas automáticamente.",
        question: "¿A qué correo te escribimos?",
        reply: "Podríamos evaluar conectar el CRM con WhatsApp Business API para registrar consultas automáticamente.",
        offerContact: true
      }),
      inputTokens: 200,
      outputTokens: 80
    })
  });

  assert.equal(aiRes.httpStatus, 200);
  assert.equal(aiRes.body.offerContact, false, "Nunca debe volver a insistir tras rechazo");
});

test("7. Error de envío inline: no muestra éxito falso y conserva el estado sin marcar submitted", async () => {
  assert.equal(isValidClientEmail("persona@gmail.com"), true);
  assert.equal(isValidClientEmail("correo-invalido"), false);

  const draft = {
    schemaVersion: 1 as const,
    savedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400_000).toISOString(),
    stage: "needs" as const,
    currentStepIndex: 0,
    brief: createEmptyBrief("Quiero un CRM", "management-systems", "development"),
    messages: [],
    answers: {},
    leadCapture: { ...createInitialLeadCapture(), status: "offered" as const }
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ ok: false, message: "Error temporal del servidor" }), {
      status: 502,
      headers: { "content-type": "application/json" }
    })) as typeof fetch;

  try {
    const res = await submitInlineContact({
      email: "cliente@gmail.com",
      draft,
      sourcePage: "/",
      idempotencyKey: "idem-err-1"
    });
    assert.equal(res.ok, false);
    assert.notEqual(res.draft.leadCapture?.status, "submitted", "No debe marcar éxito ante 502");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("8. Estado compartido entre superficies: normalizeLeadCapture conserva preguntas, estado y correo sin reiniciar", () => {
  const saved = normalizeLeadCapture({
    discoveryQuestionsAsked: 2,
    status: "declined",
    capturedEmail: "equipo@empresa.cl",
    referenceId: null,
    submittedAt: null
  });
  assert.equal(saved.discoveryQuestionsAsked, 2);
  assert.equal(saved.status, "declined");
  assert.equal(saved.capturedEmail, "equipo@empresa.cl");
});
