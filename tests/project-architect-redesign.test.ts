import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyBrief } from "../src/lib/project/schema.ts";
import { applyBriefPatch } from "../src/lib/project/state.ts";
import { processCommercialTurn } from "../src/lib/project/guided-engine.ts";
import {
  InMemoryCoordinatorStore,
  handleAssistantTurn,
  validateAndSanitizeAiOutput
} from "../src/lib/server/assistant-guard.ts";

const MANDATORY_SCENARIOS = [
  {
    id: 1,
    input: "Quiero un CRM",
    expectedCategory: "management-systems",
    expectedSelectionMode: "multi",
    expectedSignals: [/crm/i, /cliente/i, /whatsapp|cotizaciones|seguimientos/i]
  },
  {
    id: 2,
    input: "Necesito una web",
    expectedCategory: "websites",
    expectedSelectionMode: "single",
    expectedSignals: [/web/i, /reservas|ventas online|cat[aá]logo/i]
  },
  {
    id: 3,
    input: "Quiero vender más",
    expectedCategory: "digital-strategy",
    expectedSelectionMode: "multi",
    expectedSignals: [/campa[nñ]as|contenido|captaci[oó]n/i, /honorarios|anuncios/i]
  },
  {
    id: 4,
    input: "Necesito una aplicación de delivery",
    expectedCategory: "applications",
    expectedSelectionMode: "single",
    expectedSignals: [/delivery/i, /tiempo real|despacho|pagos/i]
  },
  {
    id: 5,
    input: "Quiero automatizar mi empresa",
    expectedCategory: "automations",
    expectedSelectionMode: "multi",
    expectedSignals: [/automatizar/i, /formularios|correos|whatsapp|planillas/i]
  },
  {
    id: 6,
    input: "Quiero usar IA en mi negocio",
    expectedCategory: "ai-solutions",
    expectedSelectionMode: "multi",
    expectedSignals: [/\bia\b/i, /atender|clasificar|reportes/i]
  },
  {
    id: 7,
    input: "Necesito un sistema industrial",
    expectedCategory: "management-systems",
    expectedSelectionMode: "multi",
    expectedSignals: [/industrial/i, /[oó]rdenes|trazabilidad|mantenimiento/i]
  },
  {
    id: 8,
    input: "No sé qué necesito, pero pierdo mucho tiempo usando Excel",
    expectedCategory: "management-systems",
    expectedSelectionMode: "multi",
    expectedSignals: [/excel/i, /sistema simple|centralizado|reportes/i]
  }
];

for (const sc of MANDATORY_SCENARIOS) {
  test(`Escenario obligatorio ${sc.id}: "${sc.input}" — breve, con valor, opciones contextuales y blueprint`, () => {
    const brief = createEmptyBrief("", null, "development");
    const turn = processCommercialTurn(brief, sc.input, { pageId: "/" });

    // 1. Brevedad: interpretation <= 380 chars (2-3 frases cortas, no bloques largos)
    assert.ok(
      turn.interpretation.length <= 380,
      `Respuesta demasiado extensa (${turn.interpretation.length} chars): ${turn.interpretation}`
    );

    // 2. Relevancia y valor concreto
    for (const pattern of sc.expectedSignals) {
      assert.match(turn.interpretation, pattern, `Falta señal ${pattern} en: ${turn.interpretation}`);
    }

    // 3. Una sola pregunta relevante
    assert.ok(turn.question.includes("?"), "Debe terminar con una pregunta clara");
    assert.ok((turn.question.match(/\?/g) || []).length === 1, "Debe hacer UNA sola pregunta");

    // 4. Opciones interactivas contextuales (3-5 opciones, selectionMode esperado)
    assert.ok(turn.options.length >= 3 && turn.options.length <= 5, `Opciones fuera de rango: ${turn.options.length}`);
    assert.equal(turn.selectionMode, sc.expectedSelectionMode);

    // 5. Avance inmediato del Project Blueprint
    assert.equal(turn.patch.category, sc.expectedCategory);
    assert.ok((turn.patch.addRequirements?.length || 0) >= 2, "Debe proponer al menos 2 capacidades concretas");
    assert.equal(turn.commercialStage, "possibilities");

    // 6. Ausencia de promesas injustificadas o precios cerrados
    assert.doesNotMatch(turn.reply || "", /(garantizamos ventas|primer lugar garantizado|\$\d+\s*cerrado|50% de descuento)/i);
  });
}

test("Conversación multi-turno CRM (4 turnos): usa contexto acumulado, no repite preguntas y llega a resumen/evaluación", () => {
  let brief = createEmptyBrief("", null, "development");
  const history: Array<{ role: "user" | "assistant"; text: string }> = [];

  // Turno 1: Descubrir -> Posibilidades
  const t1 = processCommercialTurn(brief, "Quiero un CRM", { pageId: "/", history });
  brief = applyBriefPatch(brief, t1.patch);
  history.push({ role: "user", text: "Quiero un CRM" }, { role: "assistant", text: t1.reply || "" });
  assert.equal(t1.commercialStage, "possibilities");
  assert.equal(brief.category, "management-systems");

  // Turno 2: Prioridades (multi-select simulado)
  const msg2 = "Me interesa priorizar: Clientes y ventas, Automatizaciones.";
  const t2 = processCommercialTurn(brief, msg2, {
    pageId: "/",
    isSelection: true,
    history,
    currentCommercialStage: t1.commercialStage
  });
  brief = applyBriefPatch(brief, t2.patch);
  history.push({ role: "user", text: msg2 }, { role: "assistant", text: t2.reply || "" });
  assert.notEqual(t2.question, t1.question, "No debe repetir la pregunta del turno 1");
  assert.ok(brief.requirements.some((r) => r.status === "confirmed"), "Debe registrar prioridad confirmada");

  // Turno 3: Usuarios / equipo
  const msg3 = "Lo usará nuestro equipo comercial de 8 vendedores y gerencia";
  const t3 = processCommercialTurn(brief, msg3, {
    pageId: "/",
    history,
    currentCommercialStage: t2.commercialStage
  });
  brief = applyBriefPatch(brief, t3.patch);
  history.push({ role: "user", text: msg3 }, { role: "assistant", text: t3.reply || "" });
  assert.ok(brief.users.length > 0, "Debe registrar usuarios del CRM");
  assert.notEqual(t3.question, t2.question, "No debe repetir pregunta de usuarios");

  // Turno 4: Plazo -> Resumen / Evaluación
  const msg4 = "Idealmente lanzarlo en 1 a 2 meses";
  const t4 = processCommercialTurn(brief, msg4, {
    pageId: "/",
    history,
    currentCommercialStage: t3.commercialStage
  });
  brief = applyBriefPatch(brief, t4.patch);
  assert.equal(brief.declaredTimeline, "en 1 a 2 meses");
  assert.ok(
    t4.commercialStage === "summary" || t4.commercialStage === "evaluation",
    `Debe avanzar a summary/evaluation, obtuvo: ${t4.commercialStage}`
  );
  assert.ok(
    t4.offerContact === true || t4.options.some((o) => o.value === "__open_submit__"),
    "Debe facilitar la solicitud de contacto o evaluación con ENIX"
  );
});

test("Manejo proactivo de 'No estoy seguro' y corrección sin reiniciar", () => {
  let brief = createEmptyBrief("Necesito una web", "websites", "development");
  const t1 = processCommercialTurn(brief, "No estoy seguro", {
    pageId: "/create-project/",
    isSelection: true,
    history: [{ role: "user", text: "Necesito una web" }]
  });
  assert.match(t1.interpretation, /no hay problema|cuello de botella|primera versi[oó]n/i);
  assert.ok(t1.options.length >= 3, "Debe proponer caminos claros cuando el usuario no está seguro");
  assert.equal(brief.idea, "Necesito una web", "No debe reiniciar ni borrar la idea original");
});

test("Salida estructurada IA: valida options, selectionMode, nextStage y projectUpdates y rechaza promesas", async () => {
  const validRaw = JSON.stringify({
    onTopic: true,
    interpretation: "¡Podemos crear un CRM ágil para centralizar clientes y automatizar seguimientos! 🚀",
    question: "¿Qué áreas quieres priorizar primero?",
    reply: "¡Podemos crear un CRM ágil para centralizar clientes y automatizar seguimientos! 🚀\n\n¿Qué áreas quieres priorizar primero?",
    options: [
      { label: "Clientes y pipeline", value: "Priorizar clientes y pipeline", kind: "neutral" },
      { label: "Automatizaciones", value: "Priorizar automatizaciones", kind: "neutral" },
      { label: "Otro", value: "__other__", kind: "other" }
    ],
    selectionMode: "multi",
    nextStage: "priorities",
    projectUpdates: {
      capabilities: ["Pipeline de oportunidades", "Recordatorios automáticos de seguimiento"],
      integrations: ["Evaluar conexión con WhatsApp"]
    },
    links: [{ label: "Sistemas de gestión", href: "/solutions/management-systems/" }]
  });

  const validated = validateAndSanitizeAiOutput(validRaw);
  assert.ok(validated);
  assert.equal(validated.selectionMode, "multi");
  assert.equal(validated.nextStage, "priorities");
  assert.equal(validated.options?.length, 3);
  assert.equal(validated.suggestedCapabilities?.length, 2);

  // Integración end-to-end con handleAssistantTurn
  const coord = new InMemoryCoordinatorStore();
  const res = await handleAssistantTurn({
    sessionId: "sess-architect-1",
    requestId: "req-arch-1",
    brief: createEmptyBrief("", null, "development"),
    answer: "Quiero un CRM",
    pageId: "/",
    aiEnabled: true,
    isProduction: false,
    providerName: "openai",
    model: "gpt-4o-mini",
    coordinator: coord,
    providerInvoker: async () => ({ rawJson: validRaw, inputTokens: 320, outputTokens: 160 })
  });

  assert.equal(res.httpStatus, 200);
  assert.equal(res.body.mode, "ai");
  assert.equal(res.body.selectionMode, "multi");
  assert.equal(res.body.commercialStage, "priorities");
  assert.equal((res.body.options as unknown[]).length, 3);

  // Rechaza promesas prohibidas
  const forbiddenRaw = JSON.stringify({
    onTopic: true,
    interpretation: "Te garantizamos ventas desde el día 1 con 50% de descuento.",
    question: "¿Agendamos?",
    reply: "Te garantizamos ventas desde el día 1 con 50% de descuento."
  });
  assert.equal(validateAndSanitizeAiOutput(forbiddenRaw), null);
});
