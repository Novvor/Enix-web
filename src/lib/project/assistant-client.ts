import {
  createEmptyBrief,
  createInitialLeadCapture,
  normalizeBrief,
  normalizeLeadCapture,
  type AssistantTurnResponse,
  type ChatMessage,
  type LeadCaptureState,
  type ProjectBrief,
  type ProjectDraft
} from "./schema.ts";
import { applyBriefPatch } from "./state.ts";
import { loadProjectDraft, saveProjectDraft } from "./storage.ts";
import { processCommercialTurn } from "./guided-engine.ts";
import { getPageContext, normalizePageId } from "./catalog.ts";

export const MAX_CLIENT_MESSAGE_CHARS = 2000;

export function makeRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `req-${crypto.randomUUID()}`;
  }
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeMessageId(prefix: "usr" | "ast"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getOrInitDraft(initialCategory: string | null = null): ProjectDraft {
  const { draft } = loadProjectDraft();
  if (draft && draft.brief) {
    return {
      ...draft,
      brief: normalizeBrief(draft.brief),
      messages: Array.isArray(draft.messages) ? draft.messages : [],
      leadCapture: normalizeLeadCapture(draft.leadCapture)
    };
  }
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    savedAt: now,
    expiresAt: now,
    stage: "idea",
    currentStepIndex: 0,
    brief: createEmptyBrief("", initialCategory, "development"),
    messages: [],
    answers: {},
    unsentText: "",
    manualFields: [],
    leadCapture: createInitialLeadCapture()
  };
}

export interface SendCommercialMessageResult {
  draft: ProjectDraft;
  response: AssistantTurnResponse;
  error?: string;
}

/**
 * Sends a single user message through `/api/project-assistant/` (1 inference max per explicit send),
 * updates the single shared draft in localStorage, and falls back gracefully to local guided mode
 * if the network is unreachable. Never loses user text.
 */
export async function sendCommercialMessage(params: {
  text: string;
  pageId: string;
  currentDraft: ProjectDraft;
  categoryHint?: string | null;
  isSelection?: boolean;
  requestId?: string;
}): Promise<SendCommercialMessageResult> {
  const cleanText = params.text.trim();
  const safePageId = normalizePageId(params.pageId);
  const pageCtx = getPageContext(safePageId);
  const requestId = params.requestId || makeRequestId();
  const baseBrief = normalizeBrief(params.currentDraft.brief);
  const manualSet = new Set(params.currentDraft.manualFields || []);

  // Ensure initial idea is recorded on brief if empty
  const workingBrief: ProjectBrief = baseBrief.idea.trim()
    ? baseBrief
    : {
        ...baseBrief,
        idea: cleanText.slice(0, 1200),
        goal: baseBrief.goal.trim() ? baseBrief.goal : cleanText.slice(0, 500)
      };

  const userMsg: ChatMessage = {
    id: makeMessageId("usr"),
    role: "user",
    stage: params.currentDraft.stage || "idea",
    text: cleanText,
    requestId,
    createdAt: new Date().toISOString()
  };

  let turn: AssistantTurnResponse | null = null;
  let recoverableError: string | undefined;

  const recentHistory = (params.currentDraft.messages || []).slice(-6).map((m) => ({
    role: m.role,
    text: m.text.slice(0, 300)
  }));

  const currentLead = normalizeLeadCapture(params.currentDraft.leadCapture);

  try {
    const res = await fetch("/api/project-assistant/", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId,
        pageId: safePageId,
        message: cleanText,
        answer: cleanText,
        brief: workingBrief,
        isSelection: Boolean(params.isSelection),
        conversationMode: "commercial",
        history: recentHistory,
        currentCommercialStage: params.currentDraft.commercialStage || "discover",
        leadCapture: currentLead
      })
    });

    const data = (await res.json().catch(() => null)) as
      | ({ ok?: boolean; message?: string; code?: string } & Partial<AssistantTurnResponse>)
      | null;

    if (res.ok && data && data.ok && typeof data.interpretation === "string") {
      turn = {
        mode: data.mode === "ai" ? "ai" : "guided",
        expectedRevision:
          typeof data.expectedRevision === "number" ? data.expectedRevision : workingBrief.revision,
        interpretation: data.interpretation,
        question: typeof data.question === "string" ? data.question : "",
        reply:
          typeof data.reply === "string"
            ? data.reply
            : [data.interpretation, data.question].filter(Boolean).join("\n\n"),
        stage: data.stage || "needs",
        commercialStage: data.commercialStage || "possibilities",
        stepId: data.stepId || "conversation",
        options: Array.isArray(data.options) ? data.options : [],
        selectionMode: data.selectionMode === "multi" ? "multi" : "single",
        blueprintHighlights: Array.isArray(data.blueprintHighlights) ? data.blueprintHighlights : [],
        offerContact: Boolean(data.offerContact),
        detectedEmail: typeof data.detectedEmail === "string" ? data.detectedEmail : null,
        contactDeclined: Boolean(data.contactDeclined),
        askedDiscoveryQuestion: Boolean(data.askedDiscoveryQuestion),
        links: Array.isArray(data.links) ? data.links : [],
        patch: data.patch || {},
        requestId,
        budgetNotice: typeof data.budgetNotice === "string" ? data.budgetNotice : undefined
      };
    } else if (res.status === 400 || res.status === 429 || res.status === 409) {
      recoverableError =
        data?.message ||
        "No pudimos enviar este mensaje ahora. Puedes reintentar en unos segundos.";
    }
  } catch {
    // Network error → fall back to local guided engine transparently
  }

  if (recoverableError && !turn) {
    return {
      draft: params.currentDraft,
      response: {
        mode: "guided",
        expectedRevision: workingBrief.revision,
        interpretation: recoverableError,
        question: "",
        reply: recoverableError,
        stage: params.currentDraft.stage,
        stepId: "conversation",
        options: [],
        patch: {}
      },
      error: recoverableError
    };
  }

  if (!turn) {
    turn = processCommercialTurn(workingBrief, cleanText, {
      pageId: safePageId,
      categoryHint: params.categoryHint ?? pageCtx.categoryHint,
      isSelection: Boolean(params.isSelection),
      history: recentHistory,
      currentCommercialStage: params.currentDraft.commercialStage || "discover",
      leadCapture: currentLead
    });
    turn.requestId = requestId;
  }

  // Re-read latest draft before patching to respect any manual edits made while waiting
  const latest = loadProjectDraft().draft;
  const targetBrief = latest?.brief ? normalizeBrief(latest.brief) : workingBrief;
  const targetManual = new Set(latest?.manualFields || Array.from(manualSet));

  const patchedBrief = applyBriefPatch(targetBrief, turn.patch, {
    expectedRevision: turn.expectedRevision,
    manualFields: targetManual
  });

  // Preserve idea if it wasn't set yet
  const finalBrief: ProjectBrief = patchedBrief.idea.trim()
    ? patchedBrief
    : { ...patchedBrief, idea: cleanText.slice(0, 1200) };

  const prevLead = normalizeLeadCapture(latest?.leadCapture || currentLead);
  const nextLead: LeadCaptureState = {
    ...prevLead,
    discoveryQuestionsAsked:
      prevLead.discoveryQuestionsAsked + (turn.askedDiscoveryQuestion ? 1 : 0),
    capturedEmail: turn.detectedEmail || prevLead.capturedEmail,
    status: turn.contactDeclined
      ? "declined"
      : prevLead.status === "submitted"
        ? "submitted"
        : prevLead.status === "declined"
          ? "declined"
          : turn.offerContact
            ? "offered"
            : prevLead.status
  };

  const assistantMsg: ChatMessage = {
    id: makeMessageId("ast"),
    role: "assistant",
    stage: turn.stage,
    commercialStage: turn.commercialStage,
    stepId: turn.stepId,
    text: turn.reply || [turn.interpretation, turn.question].filter(Boolean).join("\n\n"),
    interpretation: turn.interpretation,
    options: turn.options,
    selectionMode: turn.selectionMode || "single",
    blueprintHighlights: turn.blueprintHighlights || [],
    offerContact: Boolean(turn.offerContact && nextLead.status !== "declined" && nextLead.status !== "submitted"),
    detectedEmail: turn.detectedEmail || null,
    links: turn.links,
    mode: turn.mode,
    requestId,
    createdAt: new Date().toISOString()
  };

  const baseMessages = latest?.messages?.length
    ? latest.messages
    : params.currentDraft.messages;

  const updatedDraft: ProjectDraft = {
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    expiresAt: params.currentDraft.expiresAt,
    stage: turn.stage,
    commercialStage: turn.commercialStage || params.currentDraft.commercialStage || "possibilities",
    currentStepIndex: params.currentDraft.currentStepIndex,
    brief: finalBrief,
    messages: [...baseMessages, userMsg, assistantMsg],
    answers: {
      ...(latest?.answers || params.currentDraft.answers),
      [requestId]: cleanText
    },
    unsentText: "",
    lastPageId: safePageId,
    manualFields: Array.from(targetManual),
    pendingRequestId: null,
    leadCapture: nextLead
  };

  saveProjectDraft(updatedDraft);

  return { draft: updatedDraft, response: turn };
}

export function isValidClientEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/**
 * Marks contact as declined in the shared draft so Steve stops insisting
 * across Hero, Contextual Drawer, and /create-project/. Zero AI calls.
 */
export function declineInlineContact(currentDraft: ProjectDraft): ProjectDraft {
  const latest = loadProjectDraft().draft || currentDraft;
  const prevLead = normalizeLeadCapture(latest.leadCapture);
  const updated: ProjectDraft = {
    ...latest,
    savedAt: new Date().toISOString(),
    leadCapture: {
      ...prevLead,
      status: prevLead.status === "submitted" ? "submitted" : "declined"
    }
  };
  saveProjectDraft(updated);
  return updated;
}

export interface SubmitInlineContactResult {
  ok: boolean;
  draft: ProjectDraft;
  referenceId?: string;
  message: string;
}

/**
 * Submits quick inline contact (email + partial brief) to /api/project-submit/.
 * Zero AI calls. Only marks status="submitted" after server confirms ok:true.
 */
export async function submitInlineContact(params: {
  email: string;
  draft: ProjectDraft;
  sourcePage: string;
  idempotencyKey: string;
}): Promise<SubmitInlineContactResult> {
  const cleanEmail = params.email.trim().toLowerCase();
  if (!isValidClientEmail(cleanEmail)) {
    return {
      ok: false,
      draft: params.draft,
      message: "Ingresa un correo electrónico válido (puede ser personal o de empresa)."
    };
  }

  try {
    const conversationExcerpt = (params.draft.messages || []).slice(-10).map((m) => ({
      role: m.role === "assistant" ? "Steve" : "Visitante",
      text: m.text.slice(0, 400)
    }));

    const res = await fetch("/api/project-submit/", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quickContact: true,
        email: cleanEmail,
        sourcePage: params.sourcePage,
        idempotencyKey: params.idempotencyKey,
        brief: params.draft.brief,
        conversationExcerpt
      })
    });

    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      referenceId?: string;
      message?: string;
    } | null;

    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        draft: params.draft,
        message:
          data?.message ||
          "No pudimos enviar tu solicitud en este momento. Tus datos siguen aquí para reintentar."
      };
    }

    const latest = loadProjectDraft().draft || params.draft;
    const prevLead = normalizeLeadCapture(latest.leadCapture);
    const refId = data.referenceId || prevLead.referenceId || "ENIX";
    const updated: ProjectDraft = {
      ...latest,
      savedAt: new Date().toISOString(),
      commercialStage: "evaluation",
      stage: "summary",
      leadCapture: {
        ...prevLead,
        status: "submitted",
        capturedEmail: cleanEmail,
        referenceId: refId,
        submittedAt: new Date().toISOString()
      }
    };
    saveProjectDraft(updated);

    return {
      ok: true,
      draft: updated,
      referenceId: refId,
      message: data.message || `Solicitud recibida (referencia ${refId}).`
    };
  } catch {
    return {
      ok: false,
      draft: params.draft,
      message: "Error de conexión al enviar. Tu correo y borrador siguen guardados para reintentar."
    };
  }
}
