import {
  CATEGORY_LABELS,
  MODALITY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TRACK_LABELS,
  type ProjectBrief,
  type Requirement
} from "./schema.ts";

function formatRequirementLine(req: Requirement): string {
  const status = STATUS_LABELS[req.status];
  const priority = req.priority !== "undecided" ? ` · ${PRIORITY_LABELS[req.priority]}` : "";
  return `- [${status}${priority}] ${req.text}`;
}

export function briefToMarkdown(brief: ProjectBrief): string {
  const categoryLabel = brief.category ? CATEGORY_LABELS[brief.category] || brief.category : "Por definir";
  const trackLabel = TRACK_LABELS[brief.track || "development"];
  const audienceLabel =
    brief.audience === "entrepreneur"
      ? "Emprendedor / Negocio"
      : brief.audience === "business"
        ? "Empresa / Operación"
        : "Por definir";

  const isMarketingOrCombined = brief.track === "marketing" || brief.track === "combined";
  const essentialReqs = brief.requirements.filter((r) => r.priority === "initial" || r.priority === "undecided");
  const laterReqs = brief.requirements.filter((r) => r.priority === "later");
  const effectiveTitle = brief.title.trim() || "Proyecto en definición";
  const effectiveGoal = brief.goal.trim() || brief.commercialGoal?.trim() || brief.idea.trim() || "Por definir";

  const lines: string[] = [
    `# Ficha de proyecto — ${effectiveTitle}`,
    "",
    `> Documento de trabajo generado en el Asistente de proyectos ENIX Studio (Revisión #${brief.revision}).`,
    "> Este resumen ordena el alcance inicial; no constituye una propuesta comercial cerrada ni un contrato.",
    "",
    "## Resumen general",
    `- **Enfoque del proyecto:** ${trackLabel}`,
    `- **Tipo de solución / servicio:** ${categoryLabel}`,
    `- **Contexto:** ${audienceLabel}`,
    `- **Idea original:** ${brief.idea || "Por definir"}`,
    `- **Objetivo principal:** ${effectiveGoal}`
  ];

  if (brief.businessOffer && brief.businessOffer !== brief.idea) {
    lines.push(`- **Qué ofrece el negocio:** ${brief.businessOffer}`);
  }
  if (brief.commercialGoal && brief.commercialGoal !== effectiveGoal) {
    lines.push(`- **Objetivo comercial:** ${brief.commercialGoal}`);
  }
  if (brief.targetAudienceAndTerritory) {
    lines.push(`- **Público y territorio:** ${brief.targetAudienceAndTerritory}`);
  }
  if (brief.existingChannelsAndAssets) {
    lines.push(`- **Canales y antecedentes declarados:** ${brief.existingChannelsAndAssets}`);
  }
  if (isMarketingOrCombined) {
    lines.push(
      `- **Modalidad de trabajo:** ${MODALITY_LABELS[brief.engagementModality || "undecided"]}`
    );
  }
  if (brief.currentSituation && brief.currentSituation !== brief.existingChannelsAndAssets) {
    lines.push(`- **Situación actual:** ${brief.currentSituation}`);
  }
  if (brief.expectedOutcome) {
    lines.push(`- **Resultado esperado:** ${brief.expectedOutcome}`);
  }
  lines.push("");

  if (brief.users.length > 0) {
    lines.push("## Personas usuarias y responsabilidades");
    for (const u of brief.users) lines.push(formatRequirementLine(u));
    lines.push("");
  }

  lines.push(isMarketingOrCombined ? "## Servicios y entregables esenciales" : "## Lo esencial para empezar");
  if (essentialReqs.length > 0) {
    for (const r of essentialReqs) lines.push(formatRequirementLine(r));
  } else {
    lines.push("- Por definir");
  }
  lines.push("");

  if (laterReqs.length > 0) {
    lines.push("## Para después");
    for (const r of laterReqs) lines.push(formatRequirementLine(r));
    lines.push("");
  }

  if (brief.integrations.length > 0) {
    lines.push("## Integraciones y herramientas existentes");
    for (const i of brief.integrations) lines.push(formatRequirementLine(i));
    lines.push("");
  }

  if (brief.indicatorsToAgree && brief.indicatorsToAgree.length > 0) {
    lines.push("## Indicadores por acordar");
    for (const ind of brief.indicatorsToAgree) lines.push(formatRequirementLine(ind));
    lines.push("");
  }

  if (brief.constraints.length > 0) {
    lines.push("## Restricciones y consideraciones");
    for (const c of brief.constraints) lines.push(formatRequirementLine(c));
    lines.push("");
  }

  if (brief.openQuestions.length > 0) {
    lines.push("## Decisiones pendientes / Por definir");
    for (const q of brief.openQuestions) lines.push(`- ${q}`);
    lines.push("");
  }

  lines.push("## Fechas e inversión declaradas");
  lines.push(`- **Expectativa de lanzamiento / fechas:** ${brief.declaredTimeline || "Por definir"}`);
  if (isMarketingOrCombined) {
    lines.push(
      `- **Inversión publicitaria (anuncios en plataformas):** ${brief.adSpendBudget || "Por definir"}`
    );
    lines.push(
      `- **Presupuesto de servicios (honorarios ENIX):** ${brief.serviceBudget || brief.declaredBudget || "Por definir"}`
    );
  } else {
    lines.push(`- **Inversión referencial:** ${brief.declaredBudget || "Por definir"}`);
  }
  lines.push("");
  lines.push("## Próximo paso recomendado");
  lines.push(brief.nextStep || "Revisar esta ficha con el equipo de ENIX Studio.");
  lines.push("");
  lines.push(`_Actualizado: ${new Date(brief.updatedAt).toLocaleString("es-CL")}_`);

  return lines.join("\n");
}

export function briefToPlainText(brief: ProjectBrief): string {
  return briefToMarkdown(brief)
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/^>\s?/gm, "");
}

export function downloadTextFile(filename: string, content: string, mimeType = "text/markdown;charset=utf-8"): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const SAFE_MAILTO_BODY_LIMIT = 1400;

export interface MailtoPreparedResult {
  href: string;
  isAbbreviated: boolean;
  bodyText: string;
}

/**
 * Prepares a mailto: link without silent mid-sentence truncation (ENX-02).
 * If the full brief exceeds safe mailto URL limits, prepares a clean structured
 * summary explicitly noting that the full document should be attached or pasted.
 */
export function prepareMailto(brief: ProjectBrief, toEmail = "hello@enix.studio"): MailtoPreparedResult {
  const effectiveTitle = brief.title.trim() || "Proyecto en definición";
  const subject = `[ENIX Studio] Ficha de proyecto — ${effectiveTitle}`;
  const fullText = briefToPlainText(brief);

  if (fullText.length <= SAFE_MAILTO_BODY_LIMIT) {
    return {
      href: `mailto:${toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullText)}`,
      isAbbreviated: false,
      bodyText: fullText
    };
  }

  const categoryLabel = brief.category ? CATEGORY_LABELS[brief.category] || brief.category : "Por definir";
  const isMarketingOrCombined = brief.track === "marketing" || brief.track === "combined";
  const summaryLines = [
    `Hola equipo de ENIX Studio,`,
    "",
    `Comparto un resumen breve de mi proyecto (la ficha completa supera el límite del enlace de correo; puedes adjuntar el archivo .md/.txt descargado o pegar la ficha completa copiada desde la web).`,
    "",
    `- Proyecto: ${effectiveTitle}`,
    `- Enfoque: ${TRACK_LABELS[brief.track || "development"]} (${categoryLabel})`,
    `- Objetivo: ${(brief.goal || brief.commercialGoal || brief.idea || "Por definir").slice(0, 260)}`,
    brief.targetAudienceAndTerritory ? `- Público y territorio: ${brief.targetAudienceAndTerritory.slice(0, 140)}` : "",
    isMarketingOrCombined ? `- Modalidad: ${MODALITY_LABELS[brief.engagementModality || "undecided"]}` : "",
    `- Fechas / lanzamiento: ${(brief.declaredTimeline || "Por definir").slice(0, 140)}`,
    isMarketingOrCombined ? `- Inversión en anuncios: ${(brief.adSpendBudget || "Por definir").slice(0, 120)}` : "",
    isMarketingOrCombined ? `- Honorarios / servicios: ${(brief.serviceBudget || "Por definir").slice(0, 120)}` : "",
    "",
    "Nota: Recuerda adjuntar tu archivo descargado o pegar la ficha completa antes de enviar este correo."
  ].filter((line, idx, arr) => !(line === "" && arr[idx - 1] === ""));

  const abbreviatedBody = summaryLines.join("\n");
  return {
    href: `mailto:${toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(abbreviatedBody)}`,
    isAbbreviated: true,
    bodyText: abbreviatedBody
  };
}

export function buildMailtoHref(brief: ProjectBrief, toEmail = "hello@enix.studio"): string {
  return prepareMailto(brief, toEmail).href;
}

export function buildSlugFilename(title: string, ext: "md" | "txt"): string {
  const slug = (title || "proyecto-enix")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `ficha-${slug || "proyecto-enix"}.${ext}`;
}
