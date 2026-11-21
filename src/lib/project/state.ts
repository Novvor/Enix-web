import {
  type BriefPatch,
  type ProjectBrief,
  type Requirement,
  type RequirementPriority,
  type RequirementStatus,
  makeRequirement
} from "./schema.ts";

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Merges incoming requirements into an existing list.
 * Precedence rule (spec §8):
 * - A confirmed or manually edited requirement is NEVER overwritten or downgraded by assistant suggestions.
 * - Duplicate text (normalized) is merged rather than duplicated.
 */
export function mergeRequirements(
  existing: Requirement[],
  incoming: Requirement[] | undefined
): Requirement[] {
  if (!incoming || incoming.length === 0) return existing;

  const result = [...existing];
  for (const item of incoming) {
    const cleanText = item.text.trim();
    if (!cleanText) continue;
    const norm = normalizeText(cleanText);
    const existingIndex = result.findIndex(
      (r) => r.id === item.id || normalizeText(r.text) === norm
    );

    if (existingIndex === -1) {
      result.push({ ...item, text: cleanText });
      continue;
    }

    const current = result[existingIndex];
    // Protect manual edits and confirmed items from assistant/guided suggestions
    if (current.origin === "manual-edit") {
      continue;
    }
    if (current.status === "confirmed" && item.status !== "confirmed") {
      continue;
    }
    // Upgrade suggested/pending to confirmed if user explicitly confirmed it
    if (item.status === "confirmed" && current.status !== "confirmed") {
      result[existingIndex] = {
        ...current,
        status: "confirmed",
        origin: item.origin,
        priority: item.priority !== "undecided" ? item.priority : current.priority
      };
    }
  }
  return result;
}

/**
 * Applies a structured patch to the ProjectBrief with revision control.
 * If expectedRevision is provided and is strictly older than brief.revision,
 * stale non-manual patches are ignored so slow async responses never overwrite recent manual edits.
 */
export function applyBriefPatch(
  brief: ProjectBrief,
  patch: BriefPatch,
  options: { expectedRevision?: number; isManual?: boolean; manualFields?: Set<string> } = {}
): ProjectBrief {
  const { expectedRevision, isManual = false, manualFields } = options;

  if (!isManual && expectedRevision !== undefined && expectedRevision < brief.revision) {
    // Reject stale response to protect recent edits
    return brief;
  }

  const canOverwriteScalar = (field: string, currentVal: string) => {
    if (isManual) return true;
    if (manualFields?.has(field)) return false;
    return !currentVal.trim();
  };

  const next: ProjectBrief = {
    ...brief,
    revision: brief.revision + 1,
    updatedAt: new Date().toISOString()
  };

  const isPlaceholderTitle = (val: string) =>
    !val.trim() || /^nuevo proyecto digital$/i.test(val.trim()) || /^proyecto de /i.test(val.trim());

  if (patch.title !== undefined && patch.title.trim()) {
    if (isManual || (!manualFields?.has("title") && isPlaceholderTitle(brief.title))) {
      next.title = patch.title.trim().slice(0, 120);
    }
  }

  if (patch.goal !== undefined && patch.goal.trim()) {
    if (canOverwriteScalar("goal", brief.goal)) {
      next.goal = patch.goal.trim().slice(0, 500);
    }
  }

  if (patch.currentSituation !== undefined && patch.currentSituation.trim()) {
    if (isManual || !manualFields?.has("currentSituation")) {
      next.currentSituation = patch.currentSituation.trim().slice(0, 400);
    }
  }

  if (patch.expectedOutcome !== undefined && patch.expectedOutcome.trim()) {
    if (isManual || !manualFields?.has("expectedOutcome")) {
      next.expectedOutcome = patch.expectedOutcome.trim().slice(0, 400);
    }
  }

  if (patch.category !== undefined) {
    if (isManual || !manualFields?.has("category")) {
      next.category = patch.category;
    }
  }

  if (patch.audience !== undefined && patch.audience !== "undetermined") {
    if (isManual || brief.audience === "undetermined" || !manualFields?.has("audience")) {
      next.audience = patch.audience;
    }
  }

  if (patch.track !== undefined) {
    if (isManual || !manualFields?.has("track")) {
      next.track = patch.track;
    }
  }

  if (patch.declaredBudget !== undefined) {
    if (isManual || !manualFields?.has("declaredBudget")) {
      next.declaredBudget = patch.declaredBudget;
    }
  }

  if (patch.declaredTimeline !== undefined) {
    if (isManual || !manualFields?.has("declaredTimeline")) {
      next.declaredTimeline = patch.declaredTimeline;
    }
  }

  if (patch.businessOffer !== undefined && patch.businessOffer.trim()) {
    if (isManual || !manualFields?.has("businessOffer")) {
      next.businessOffer = patch.businessOffer.trim().slice(0, 300);
    }
  }

  if (patch.commercialGoal !== undefined && patch.commercialGoal.trim()) {
    if (isManual || !manualFields?.has("commercialGoal")) {
      next.commercialGoal = patch.commercialGoal.trim().slice(0, 320);
    }
  }

  if (patch.targetAudienceAndTerritory !== undefined && patch.targetAudienceAndTerritory.trim()) {
    if (isManual || !manualFields?.has("targetAudienceAndTerritory")) {
      next.targetAudienceAndTerritory = patch.targetAudienceAndTerritory.trim().slice(0, 300);
    }
  }

  if (patch.existingChannelsAndAssets !== undefined && patch.existingChannelsAndAssets.trim()) {
    if (isManual || !manualFields?.has("existingChannelsAndAssets")) {
      next.existingChannelsAndAssets = patch.existingChannelsAndAssets.trim().slice(0, 320);
    }
  }

  if (patch.engagementModality !== undefined) {
    if (isManual || !manualFields?.has("engagementModality")) {
      next.engagementModality = patch.engagementModality;
    }
  }

  if (patch.adSpendBudget !== undefined) {
    if (isManual || !manualFields?.has("adSpendBudget")) {
      next.adSpendBudget = patch.adSpendBudget;
    }
  }

  if (patch.serviceBudget !== undefined) {
    if (isManual || !manualFields?.has("serviceBudget")) {
      next.serviceBudget = patch.serviceBudget;
    }
  }

  if (patch.nextStep !== undefined && patch.nextStep.trim()) {
    next.nextStep = patch.nextStep.trim().slice(0, 300);
  }

  next.users = mergeRequirements(brief.users, patch.addUsers);
  next.requirements = mergeRequirements(brief.requirements, patch.addRequirements);
  next.integrations = mergeRequirements(brief.integrations, patch.addIntegrations);
  next.constraints = mergeRequirements(brief.constraints, patch.addConstraints);
  next.indicatorsToAgree = mergeRequirements(brief.indicatorsToAgree || [], patch.addIndicators);

  if (patch.addOpenQuestions && patch.addOpenQuestions.length > 0) {
    const existingNorm = new Set(brief.openQuestions.map(normalizeText));
    const merged = [...brief.openQuestions];
    for (const q of patch.addOpenQuestions) {
      const clean = q.trim();
      if (clean && !existingNorm.has(normalizeText(clean))) {
        merged.push(clean);
        existingNorm.add(normalizeText(clean));
      }
    }
    next.openQuestions = merged;
  }

  return next;
}

export type RequirementBucket =
  | "users"
  | "requirements"
  | "integrations"
  | "constraints"
  | "indicatorsToAgree";

export function updateRequirementInBrief(
  brief: ProjectBrief,
  bucket: RequirementBucket,
  id: string,
  updater: (req: Requirement) => Requirement | null
): ProjectBrief {
  const list = brief[bucket] || [];
  const updated: Requirement[] = [];
  let changed = false;

  for (const item of list) {
    if (item.id !== id) {
      updated.push(item);
      continue;
    }
    changed = true;
    const nextItem = updater(item);
    if (nextItem) {
      updated.push({ ...nextItem, origin: "manual-edit" });
    }
  }

  if (!changed) return brief;
  return {
    ...brief,
    [bucket]: updated,
    revision: brief.revision + 1,
    updatedAt: new Date().toISOString()
  };
}

export function confirmRequirement(
  brief: ProjectBrief,
  bucket: RequirementBucket,
  id: string
): ProjectBrief {
  return updateRequirementInBrief(brief, bucket, id, (req) => ({
    ...req,
    status: "confirmed" as RequirementStatus
  }));
}

export function toggleRequirementPriority(
  brief: ProjectBrief,
  bucket: RequirementBucket,
  id: string,
  priority: RequirementPriority
): ProjectBrief {
  return updateRequirementInBrief(brief, bucket, id, (req) => ({
    ...req,
    priority
  }));
}

export function removeRequirement(
  brief: ProjectBrief,
  bucket: RequirementBucket,
  id: string
): ProjectBrief {
  return updateRequirementInBrief(brief, bucket, id, () => null);
}

export function addManualRequirement(
  brief: ProjectBrief,
  bucket: RequirementBucket,
  text: string,
  priority: RequirementPriority = "initial"
): ProjectBrief {
  const clean = text.trim();
  if (!clean) return brief;
  const req = makeRequirement(clean, "confirmed", "manual-edit", priority, bucket.slice(0, 3));
  return {
    ...brief,
    [bucket]: mergeRequirements(brief[bucket] || [], [req]),
    revision: brief.revision + 1,
    updatedAt: new Date().toISOString()
  };
}
