export type RequirementStatus = "confirmed" | "suggested" | "pending";
export type RequirementOrigin = "user" | "selection" | "assistant" | "manual-edit";
export type RequirementPriority = "initial" | "later" | "undecided";
export type ProjectStage = "idea" | "needs" | "priorities" | "summary";
export type CommercialStage =
  | "discover"
  | "possibilities"
  | "priorities"
  | "scope"
  | "summary"
  | "evaluation";
export type SelectionMode = "single" | "multi";
export type ProjectAudience = "entrepreneur" | "business" | "undetermined";
export type ProjectTrack = "development" | "marketing" | "combined";
export type EngagementModality = "one-time" | "ongoing" | "one-time-then-ongoing" | "undecided";

export interface Requirement {
  id: string;
  text: string;
  status: RequirementStatus;
  origin: RequirementOrigin;
  priority: RequirementPriority;
}

export interface ProjectBrief {
  schemaVersion: 1;
  revision: number;
  track: ProjectTrack;
  title: string;
  idea: string;
  goal: string;
  currentSituation: string;
  expectedOutcome: string;
  category: string | null;
  audience: ProjectAudience;
  users: Requirement[];
  requirements: Requirement[];
  integrations: Requirement[];
  constraints: Requirement[];
  openQuestions: string[];
  declaredBudget: string | null;
  declaredTimeline: string | null;
  // Optional marketing & combined fields (backward compatible with v1 drafts)
  businessOffer?: string;
  commercialGoal?: string;
  targetAudienceAndTerritory?: string;
  existingChannelsAndAssets?: string;
  engagementModality?: EngagementModality;
  indicatorsToAgree?: Requirement[];
  adSpendBudget?: string | null;
  serviceBudget?: string | null;
  nextStep: string;
  updatedAt: string;
}

export interface ChatOption {
  id: string;
  label: string;
  value: string;
  kind?: "primary" | "neutral" | "other" | "unsure";
  description?: string;
}

export interface ChatLink {
  label: string;
  href: string;
}

export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  stage: ProjectStage;
  commercialStage?: CommercialStage;
  stepId?: string;
  text: string;
  interpretation?: string;
  options?: ChatOption[];
  selectionMode?: SelectionMode;
  blueprintHighlights?: string[];
  links?: ChatLink[];
  mode?: "ai" | "guided";
  requestId?: string;
  createdAt: string;
  editable?: boolean;
}

export interface BriefPatch {
  track?: ProjectTrack;
  title?: string;
  goal?: string;
  currentSituation?: string;
  expectedOutcome?: string;
  category?: string | null;
  audience?: ProjectAudience;
  addUsers?: Requirement[];
  addRequirements?: Requirement[];
  addIntegrations?: Requirement[];
  addConstraints?: Requirement[];
  addOpenQuestions?: string[];
  declaredBudget?: string | null;
  declaredTimeline?: string | null;
  businessOffer?: string;
  commercialGoal?: string;
  targetAudienceAndTerritory?: string;
  existingChannelsAndAssets?: string;
  engagementModality?: EngagementModality;
  addIndicators?: Requirement[];
  adSpendBudget?: string | null;
  serviceBudget?: string | null;
  nextStep?: string;
}

export interface AssistantTurnResponse {
  mode: "ai" | "guided";
  expectedRevision: number;
  interpretation: string;
  question: string;
  reply?: string;
  stage: ProjectStage;
  commercialStage?: CommercialStage;
  stepId: string;
  options: ChatOption[];
  selectionMode?: SelectionMode;
  blueprintHighlights?: string[];
  links?: ChatLink[];
  patch: BriefPatch;
  requestId?: string;
  budgetNotice?: string;
}

export interface ProjectDraft {
  schemaVersion: 1;
  savedAt: string;
  expiresAt: string;
  stage: ProjectStage;
  commercialStage?: CommercialStage;
  currentStepIndex: number;
  brief: ProjectBrief;
  messages: ChatMessage[];
  answers: Record<string, string>;
  unsentText?: string;
  lastPageId?: string;
  manualFields?: string[];
  pendingRequestId?: string | null;
}

export interface BriefReadiness {
  defined: string[];
  toClarify: string[];
}

export function computeBriefReadiness(brief: ProjectBrief): BriefReadiness {
  const defined: string[] = [];
  const toClarify: string[] = [];

  if (brief.idea.trim() || brief.goal.trim()) {
    defined.push("Idea y objetivo principal");
  } else {
    toClarify.push("Idea u objetivo principal");
  }

  if (brief.category && brief.category !== "undetermined") {
    defined.push(`Enfoque: ${CATEGORY_LABELS[brief.category] || brief.category}`);
  } else {
    toClarify.push("Tipo de solución o servicio");
  }

  const isMkt = brief.track === "marketing" || brief.track === "combined";

  if (isMkt) {
    if (brief.targetAudienceAndTerritory?.trim()) {
      defined.push("Público y territorio");
    } else {
      toClarify.push("Público y territorio");
    }
    if (brief.existingChannelsAndAssets?.trim()) {
      defined.push("Canales y situación actual");
    } else {
      toClarify.push("Canales o web actual");
    }
    if (brief.engagementModality && brief.engagementModality !== "undecided") {
      defined.push("Modalidad de trabajo");
    } else {
      toClarify.push("Modalidad (puntual o periódico)");
    }
    if (brief.adSpendBudget && brief.adSpendBudget !== "Por definir") {
      defined.push("Inversión publicitaria referencial");
    }
  } else {
    if (brief.users.length > 0) {
      defined.push("Usuarios principales");
    } else {
      toClarify.push("Quiénes lo usarán");
    }
    if (brief.currentSituation.trim()) {
      defined.push("Situación actual");
    } else {
      toClarify.push("Cómo lo resuelven hoy");
    }
  }

  const confirmedReqs = brief.requirements.filter((r) => r.status === "confirmed");
  if (confirmedReqs.length > 0) {
    defined.push(`${confirmedReqs.length} punto${confirmedReqs.length === 1 ? "" : "s"} confirmado${confirmedReqs.length === 1 ? "" : "s"}`);
  } else {
    toClarify.push("Alcance inicial prioritario");
  }

  if (brief.declaredTimeline && brief.declaredTimeline !== "Por definir") {
    defined.push("Plazo de referencia");
  } else {
    toClarify.push("Plazo o fecha objetivo");
  }

  return { defined, toClarify };
}

export const CATEGORY_LABELS: Record<string, string> = {
  websites: "Sitio web",
  applications: "Aplicación",
  "management-systems": "Sistema de gestión",
  platforms: "Portal o plataforma",
  automations: "Automatización",
  "ai-solutions": "Solución de IA",
  marketing: "Marketing digital",
  "digital-strategy": "Estrategia digital",
  "digital-advertising": "Publicidad digital",
  "seo-local": "SEO y presencia local",
  "content-social": "Contenido y redes sociales",
  "email-crm-automation": "Email y automatización comercial",
  "analytics-cro": "Analítica y conversión",
  "brand-design": "Branding y diseño de marca",
  combined: "Desarrollo + Marketing digital",
  undetermined: "Por definir"
};

export const TRACK_LABELS: Record<ProjectTrack, string> = {
  development: "Proyecto de desarrollo",
  marketing: "Marketing digital y marca",
  combined: "Desarrollo + Marketing"
};

export const MODALITY_LABELS: Record<EngagementModality, string> = {
  "one-time": "Trabajo puntual",
  ongoing: "Acompañamiento periódico",
  "one-time-then-ongoing": "Trabajo puntual inicial y evaluación de continuidad",
  undecided: "Por definir"
};

export const STAGE_LABELS: Record<ProjectStage, string> = {
  idea: "Idea",
  needs: "Necesidades",
  priorities: "Prioridades",
  summary: "Resumen"
};

export const COMMERCIAL_STAGE_ORDER: CommercialStage[] = [
  "discover",
  "possibilities",
  "priorities",
  "scope",
  "summary",
  "evaluation"
];

export const COMMERCIAL_STAGE_LABELS: Record<CommercialStage, string> = {
  discover: "Descubrir idea",
  possibilities: "Posibilidades",
  priorities: "Prioridades",
  scope: "Alcance",
  summary: "Resumen",
  evaluation: "Evaluación"
};

export function mapCommercialStageToProjectStage(stage: CommercialStage): ProjectStage {
  switch (stage) {
    case "discover":
      return "idea";
    case "possibilities":
      return "needs";
    case "priorities":
    case "scope":
      return "priorities";
    case "summary":
    case "evaluation":
      return "summary";
  }
}

export const STATUS_LABELS: Record<RequirementStatus, string> = {
  confirmed: "Confirmado",
  suggested: "Sugerido",
  pending: "Por definir"
};

export const PRIORITY_LABELS: Record<RequirementPriority, string> = {
  initial: "Lo esencial",
  later: "Para después",
  undecided: "Por definir"
};

export const MARKETING_CATEGORY_SLUGS = new Set([
  "marketing",
  "digital-strategy",
  "digital-advertising",
  "seo-local",
  "content-social",
  "email-crm-automation",
  "analytics-cro",
  "brand-design"
]);

export function createEmptyBrief(
  initialIdea = "",
  initialCategory: string | null = null,
  track: ProjectTrack = "development"
): ProjectBrief {
  const cleanIdea = initialIdea.trim();
  const inferredTitle = cleanIdea ? deriveProvisionalTitle(cleanIdea, initialCategory) : "";
  return {
    schemaVersion: 1,
    revision: 1,
    track,
    title: inferredTitle,
    idea: cleanIdea,
    goal: cleanIdea,
    currentSituation: "",
    expectedOutcome: "",
    category: initialCategory,
    audience: "undetermined",
    users: [],
    requirements: [],
    integrations: [],
    constraints: [],
    openQuestions: [],
    declaredBudget: null,
    declaredTimeline: null,
    businessOffer: "",
    commercialGoal: "",
    targetAudienceAndTerritory: "",
    existingChannelsAndAssets: "",
    engagementModality: "undecided",
    indicatorsToAgree: [],
    adSpendBudget: null,
    serviceBudget: null,
    nextStep: "Completar la ficha y revisar prioridades para preparar una evaluación con ENIX Studio.",
    updatedAt: new Date().toISOString()
  };
}

/** Ensures drafts saved before the marketing expansion load cleanly with defaults. */
export function normalizeBrief(raw: Partial<ProjectBrief>): ProjectBrief {
  const base = createEmptyBrief(raw.idea || "", raw.category ?? null, raw.track || "development");
  return {
    ...base,
    ...raw,
    track: raw.track || (raw.category && MARKETING_CATEGORY_SLUGS.has(raw.category) ? "marketing" : "development"),
    indicatorsToAgree: Array.isArray(raw.indicatorsToAgree) ? raw.indicatorsToAgree : [],
    engagementModality: raw.engagementModality || "undecided"
  };
}

export function deriveProvisionalTitle(idea: string, category: string | null): string {
  const trimmed = idea.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return category && CATEGORY_LABELS[category]
      ? `Proyecto de ${CATEGORY_LABELS[category].toLowerCase()}`
      : "Nuevo proyecto digital";
  }
  const firstSentence = trimmed.split(/[.!?\n]/)[0]?.trim() || trimmed;
  if (firstSentence.length <= 64) return firstSentence;
  return `${firstSentence.slice(0, 61).trimEnd()}…`;
}

export function makeRequirement(
  text: string,
  status: RequirementStatus,
  origin: RequirementOrigin,
  priority: RequirementPriority = "initial",
  idPrefix = "req"
): Requirement {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);
  return {
    id: `${idPrefix}-${normalized || Math.random().toString(36).slice(2, 8)}`,
    text: text.trim().slice(0, 220),
    status,
    origin,
    priority
  };
}

export function isValidBriefPatch(input: unknown): input is BriefPatch {
  if (!input || typeof input !== "object") return false;
  const obj = input as Record<string, unknown>;
  const stringFields = ["title", "goal", "currentSituation", "expectedOutcome", "nextStep"];
  for (const field of stringFields) {
    if (obj[field] !== undefined && typeof obj[field] !== "string") return false;
  }
  return true;
}
