import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyBrief, makeRequirement, normalizeBrief } from "../src/lib/project/schema.ts";
import {
  addManualRequirement,
  applyBriefPatch,
  confirmRequirement,
  toggleRequirementPriority
} from "../src/lib/project/state.ts";
import { processGuidedAnswer, startGuidedSession } from "../src/lib/project/guided-engine.ts";
import { briefToMarkdown } from "../src/lib/project/export.ts";

test("preserves starter idea and infers category without losing text", () => {
  const idea = "Necesito organizar los pedidos de mi distribuidora; hoy usamos WhatsApp y Excel.";
  const init = startGuidedSession(idea, null);
  const base = createEmptyBrief(idea, null);
  const brief = applyBriefPatch(base, init.briefPatch);

  assert.equal(brief.idea, idea);
  assert.equal(brief.category, "management-systems");
  assert.ok(brief.title.length > 0);
  assert.equal(brief.requirements[0]?.status, "confirmed");
});

test("manual edits and confirmed items take precedence over later suggestions", () => {
  let brief = createEmptyBrief("Organizar pedidos", "management-systems");
  brief = addManualRequirement(brief, "requirements", "Control de inventario", "initial");

  const manualFields = new Set<string>(["title"]);
  brief = { ...brief, title: "Sistema Mi Distribuidora", revision: brief.revision + 1 };

  const patched = applyBriefPatch(
    brief,
    {
      title: "Título sugerido por asistente",
      addRequirements: [
        makeRequirement("Control de inventario", "suggested", "assistant", "later", "sug")
      ]
    },
    { expectedRevision: brief.revision, manualFields }
  );

  assert.equal(patched.title, "Sistema Mi Distribuidora");
  const inv = patched.requirements.find((r) => r.text === "Control de inventario");
  assert.equal(inv?.status, "confirmed");
  assert.equal(inv?.origin, "manual-edit");
  assert.equal(inv?.priority, "initial");
});

test("rejects stale async patches when revision has advanced", () => {
  const brief = { ...createEmptyBrief("App de reservas", "applications"), revision: 5 };
  const afterStale = applyBriefPatch(
    brief,
    { currentSituation: "Dato atrasado" },
    { expectedRevision: 3 }
  );

  assert.equal(afterStale.revision, 5);
  assert.equal(afterStale.currentSituation, "");
});

test("guided mode marks domain proposals as suggested and reflects edits in Markdown export", () => {
  const idea = "Quiero centralizar pedidos de mi distribuidora";
  const init = startGuidedSession(idea, "management-systems");
  let brief = applyBriefPatch(createEmptyBrief(idea, "management-systems"), init.briefPatch);

  const turn = processGuidedAnswer(brief, "process", "Hoy usamos WhatsApp y Excel", true);
  brief = applyBriefPatch(brief, turn.patch, { expectedRevision: brief.revision });

  const suggested = brief.requirements.filter((r) => r.status === "suggested");
  assert.ok(suggested.length >= 2, "Debe proponer sugerencias diferenciadas");

  // Confirm first suggestion and move it to 'later'
  const first = suggested[0];
  brief = confirmRequirement(brief, "requirements", first.id);
  brief = toggleRequirementPriority(brief, "requirements", first.id, "later");

  const md = briefToMarkdown(brief);
  assert.match(md, /## Para después/);
  assert.match(md, new RegExp(`\\[Confirmado · Para después\\] ${first.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
});

test("development track: inventory system stays in development flow", () => {
  const idea = "Necesito un sistema para gestionar inventario";
  const init = startGuidedSession(idea, null);
  assert.equal(init.track, "development");
  assert.equal(init.briefPatch.category, "management-systems");
  assert.equal(init.stepId, "users");
});

test("marketing track: restaurant ads uses commercial questions and separates ad spend vs service budget", () => {
  const idea = "Tengo un restaurante y quiero conseguir más reservas con publicidad";
  const init = startGuidedSession(idea, null);
  assert.equal(init.track, "marketing");
  assert.equal(init.briefPatch.category, "digital-advertising");
  assert.equal(init.stepId, "mkt_audience_territory");

  let brief = applyBriefPatch(createEmptyBrief(idea, init.briefPatch.category, init.track), init.briefPatch);
  const t1 = processGuidedAnswer(brief, "mkt_audience_territory", "Clientes locales en Providencia, Santiago", false);
  brief = applyBriefPatch(brief, t1.patch);
  const t2 = processGuidedAnswer(brief, "mkt_assets_history", "Instagram activo, sin campañas previas", true);
  brief = applyBriefPatch(brief, t2.patch);
  const t3 = processGuidedAnswer(brief, "mkt_modality", "ongoing", true);
  brief = applyBriefPatch(brief, t3.patch);
  const t4 = processGuidedAnswer(brief, "mkt_budget_dates", "Inicio este mes", true);
  brief = applyBriefPatch(brief, t4.patch);

  brief = { ...brief, adSpendBudget: "$400.000 CLP/mes", serviceBudget: "Por definir" };
  const md = briefToMarkdown(brief);
  assert.match(md, /Marketing digital y marca/);
  assert.match(md, /Inversión publicitaria \(anuncios en plataformas\):\*\* \$400\.000 CLP\/mes/);
  assert.match(md, /Presupuesto de servicios \(estrategia, creación y gestión\):\*\* Por definir/);
  assert.match(md, /## Indicadores por acordar/);
});

test("combined track: new website + client acquisition creates one unified project", () => {
  const idea = "Quiero una nueva web y una estrategia para captar clientes";
  const init = startGuidedSession(idea, null);
  assert.equal(init.track, "combined");
  assert.equal(init.briefPatch.category, "combined");

  let brief = applyBriefPatch(createEmptyBrief(idea, "combined", "combined"), init.briefPatch);
  const t1 = processGuidedAnswer(brief, "mkt_assets_history", "Empezamos desde cero", true);
  brief = applyBriefPatch(brief, t1.patch);

  const hasDevDeliverable = brief.requirements.some((r) => /Desarrollo:/i.test(r.text));
  const hasMktDeliverable = brief.requirements.some((r) => /Marketing:/i.test(r.text));
  assert.ok(hasDevDeliverable && hasMktDeliverable, "Debe incluir entregables relacionados de desarrollo y marketing");

  // Backward compatibility check with legacy draft without marketing fields
  const legacyNormalized = normalizeBrief({
    schemaVersion: 1,
    revision: 2,
    title: "Borrador antiguo",
    idea: "Web corporativa",
    category: "websites"
  });
  assert.equal(legacyNormalized.track, "development");
  assert.deepEqual(legacyNormalized.indicatorsToAgree, []);
});
