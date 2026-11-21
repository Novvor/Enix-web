import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyBrief, MODALITY_LABELS } from "../src/lib/project/schema.ts";
import { addManualRequirement, applyBriefPatch } from "../src/lib/project/state.ts";
import { processGuidedAnswer, startGuidedSession } from "../src/lib/project/guided-engine.ts";
import { briefToMarkdown, briefToPlainText, prepareMailto } from "../src/lib/project/export.ts";

test("Prueba A (ENX-04): web de peluquería con reservas, abonos y WhatsApp clasifica como Sitio web y conserva requisitos", () => {
  const idea =
    "Quiero una web para una peluquería con reservas online, pagos de abono y recordatorios por WhatsApp. Soy una persona y quiero empezar con una primera versión.";
  const init = startGuidedSession(idea, null);
  const brief = applyBriefPatch(createEmptyBrief(idea, init.briefPatch.category, init.track), init.briefPatch);

  assert.equal(init.track, "development");
  assert.equal(brief.category, "websites");
  assert.doesNotMatch(init.question, /bodega/i);
  assert.ok(
    brief.requirements.some((r) => /reservas/i.test(r.text) && r.status === "confirmed"),
    "Debe conservar reservas online como confirmado"
  );
  assert.ok(
    brief.requirements.some((r) => /abono|pago/i.test(r.text) && r.status === "confirmed"),
    "Debe conservar pagos/abonos como confirmado"
  );
  assert.ok(
    brief.integrations.some((i) => /whatsapp/i.test(i.text) && i.status === "confirmed"),
    "Debe conservar recordatorios por WhatsApp como confirmado"
  );
});

test("Prueba B (ENX-01): recorrido completo de marketing cafetería Santiago conserva todos los campos sin inventar web/medición ni IDs técnicos", () => {
  // Paso 1: empezar proyecto nuevo y elegir Marketing digital / campañas
  let brief = createEmptyBrief("", null, "development");
  const t0 = processGuidedAnswer(brief, "category", "marketing", true);
  brief = applyBriefPatch(brief, t0.patch);

  // Paso 2: escribir negocio y objetivo
  const offerText =
    "Tengo una cafetería en Santiago y quiero aumentar las reservas de desayunos con campañas en Instagram.";
  const t1 = processGuidedAnswer(brief, "mkt_offer_goal", offerText, false);
  brief = applyBriefPatch(brief, t1.patch);

  // Paso 3: elegir Clientes locales en mi ciudad
  const t2 = processGuidedAnswer(brief, "mkt_audience_territory", "Clientes locales en mi ciudad", true);
  brief = applyBriefPatch(brief, t2.patch);

  // Paso 4: elegir Ya probé anuncios pero con pocos resultados
  const t3 = processGuidedAnswer(
    brief,
    "mkt_assets_history",
    "Ya probé anuncios anteriormente, pero con pocos resultados",
    true
  );
  brief = applyBriefPatch(brief, t3.patch);

  // Paso 5: elegir Primero un trabajo puntual y luego evaluar continuidad
  const t4 = processGuidedAnswer(brief, "mkt_modality", "one-time-then-ongoing", true);
  brief = applyBriefPatch(brief, t4.patch);

  // Paso 6: escribir fecha, presupuesto de anuncios y honorarios
  const budgetText =
    "Lanzar en dos meses. Presupuesto de anuncios: 300.000 CLP al mes. Honorarios de ENIX: por cotizar.";
  const t5 = processGuidedAnswer(brief, "mkt_budget_dates", budgetText, false);
  brief = applyBriefPatch(brief, t5.patch);

  assert.ok(brief.title.trim().length > 0, "Título no debe quedar vacío");
  assert.equal(brief.goal, offerText);
  assert.equal(brief.engagementModality, "one-time-then-ongoing");
  assert.equal(MODALITY_LABELS[brief.engagementModality], "Trabajo puntual inicial y evaluación de continuidad");
  assert.match(brief.declaredTimeline || "", /dos meses/i);
  assert.match(brief.adSpendBudget || "", /300\.000 CLP/i);
  assert.match(brief.serviceBudget || "", /por cotizar/i);

  const md = briefToMarkdown(brief);
  const txt = briefToPlainText(brief);
  assert.doesNotMatch(md, /one-time-then-ongoing/, "No deben filtrarse identificadores técnicos");
  assert.doesNotMatch(txt, /ya tenemos web/i, "No debe inventar web existente");
  assert.doesNotMatch(txt, /falta de medici[oó]n|sin suficiente conversi[oó]n ni medici[oó]n/i, "No debe inventar diagnóstico de medición");
  assert.match(md, /Trabajo puntual inicial y evaluación de continuidad/);
});

test("Prueba C (ENX-03): ediciones manuales prevalecen en todas las salidas y sin reformulación mecánica", () => {
  let brief = createEmptyBrief("Web de servicios", "websites", "development");
  const t = processGuidedAnswer(brief, "process", "No tenemos sitio web actual; empezamos desde cero", true);
  brief = applyBriefPatch(brief, t.patch);
  assert.equal(brief.expectedOutcome, "", "No debe inventar 'Resolver de forma ordenada: empezamos desde cero'");

  const manualFields = new Set(["goal", "adSpendBudget"]);
  brief = applyBriefPatch(
    brief,
    { goal: "Objetivo editado manualmente", adSpendBudget: "CLP 450.000 mensuales" },
    { isManual: true, manualFields }
  );

  // Subsequent non-manual patch must NOT overwrite manual edits
  brief = applyBriefPatch(
    brief,
    { goal: "Objetivo automático", adSpendBudget: "Por definir" },
    { expectedRevision: brief.revision, manualFields }
  );

  const md = briefToMarkdown(brief);
  assert.match(md, /Objetivo editado manualmente/);
});

test("Prueba D (ENX-02): ficha > 1800 caracteres con tildes conserva frase final en MD/TXT y mailto abrevia explícitamente sin cortar a mitad de palabra", () => {
  let brief = createEmptyBrief(
    "Plataforma B2B para gestión logística y campañas de captación en Latinoamérica con métricas detalladas.",
    "combined",
    "combined"
  );
  for (let i = 1; i <= 16; i++) {
    brief = addManualRequirement(
      brief,
      "requirements",
      `Requisito detallado número ${i}: sincronización rápida con validación de códigos, notificaciones y reportes técnicos en español.`,
      i <= 12 ? "initial" : "later"
    );
  }
  const sentinelPhrase = "FRASE FINAL VERIFICADA CON TILDES: EVALUACIÓN INTEGRAL ENIX STUDIO.";
  brief = { ...brief, nextStep: sentinelPhrase };

  const md = briefToMarkdown(brief);
  const txt = briefToPlainText(brief);
  assert.ok(txt.length > 1800, `Expected > 1800 chars, got ${txt.length}`);
  assert.ok(md.includes(sentinelPhrase), "Markdown debe conservar íntegra la frase final");
  assert.ok(txt.includes(sentinelPhrase), "TXT debe conservar íntegra la frase final");

  const mailto = prepareMailto(brief);
  assert.equal(mailto.isAbbreviated, true, "Debe identificar explícitamente que es un resumen breve");
  assert.match(mailto.bodyText, /resumen breve/i);
  assert.match(mailto.bodyText, /adjuntar|pegar la ficha completa/i);
});
