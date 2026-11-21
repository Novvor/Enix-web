import type { ProjectDraft } from "./schema.ts";

const DRAFT_STORAGE_KEY = "enix.v2.projectDraft.v1";
const STARTER_IDEA_KEY = "enix.v2.starterIdea.v1";
const CONTEXTUAL_HINT_KEY = "enix.v2.contextualHintState.v1";
const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export const DRAFT_UPDATED_EVENT = "enix:draft-updated";
export const ASSISTANT_OPEN_EVENT = "enix:assistant-open";
export const CHAT_ACTIVE_EVENT = "enix:chat-active";

let memoryDraft: ProjectDraft | null = null;
let memoryStarter: { idea: string; category?: string | null; demo?: string | null; createdAt: string } | null = null;
let memoryHintState: { shown?: boolean; dismissed?: boolean } = {};

function getSafeStorage(kind: "local" | "session"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const store = kind === "local" ? window.localStorage : window.sessionStorage;
    const probe = "__enix_storage_probe__";
    store.setItem(probe, "1");
    store.removeItem(probe);
    return store;
  } catch {
    return null;
  }
}

export interface StarterIdeaPayload {
  idea: string;
  category?: string | null;
  demo?: string | null;
  createdAt: string;
}

export interface AssistantOpenDetail {
  promptText?: string;
  category?: string | null;
  source?: string;
}

export function requestAssistantOpen(detail: AssistantOpenDetail = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AssistantOpenDetail>(ASSISTANT_OPEN_EVENT, { detail }));
}

export function notifyChatActiveState(active: boolean, surface: "hero" | "drawer" | "workspace"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_ACTIVE_EVENT, { detail: { active, surface } }));
}

export function saveStarterIdea(idea: string, category?: string | null, demo?: string | null): boolean {
  const payload: StarterIdeaPayload = {
    idea: idea.trim().slice(0, 2000),
    category: category ?? null,
    demo: demo ?? null,
    createdAt: new Date().toISOString()
  };
  memoryStarter = payload;

  const session = getSafeStorage("session");
  if (session) {
    try {
      session.setItem(STARTER_IDEA_KEY, JSON.stringify(payload));
      return true;
    } catch {
      // fall through
    }
  }
  const local = getSafeStorage("local");
  if (local) {
    try {
      local.setItem(STARTER_IDEA_KEY, JSON.stringify(payload));
      return true;
    } catch {
      // fall through
    }
  }
  return false;
}

export function consumeStarterIdea(): StarterIdeaPayload | null {
  const session = getSafeStorage("session");
  if (session) {
    try {
      const raw = session.getItem(STARTER_IDEA_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StarterIdeaPayload;
        session.removeItem(STARTER_IDEA_KEY);
        if (parsed && typeof parsed.idea === "string") {
          memoryStarter = parsed;
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  }
  const local = getSafeStorage("local");
  if (local) {
    try {
      const raw = local.getItem(STARTER_IDEA_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StarterIdeaPayload;
        local.removeItem(STARTER_IDEA_KEY);
        if (parsed && typeof parsed.idea === "string") {
          memoryStarter = parsed;
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  }
  return memoryStarter;
}

export function saveProjectDraft(draft: Omit<ProjectDraft, "savedAt" | "expiresAt">): boolean {
  const now = Date.now();
  const fullDraft: ProjectDraft = {
    ...draft,
    savedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + DRAFT_TTL_MS).toISOString()
  };
  memoryDraft = fullDraft;

  let persisted = false;
  const local = getSafeStorage("local");
  if (local) {
    try {
      local.setItem(DRAFT_STORAGE_KEY, JSON.stringify(fullDraft));
      persisted = true;
    } catch {
      persisted = false;
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(DRAFT_UPDATED_EVENT, { detail: fullDraft }));
  }
  return persisted;
}

export interface LoadDraftResult {
  draft: ProjectDraft | null;
  storageAvailable: boolean;
  incompatibleRaw?: string | null;
}

export function loadProjectDraft(): LoadDraftResult {
  const local = getSafeStorage("local");
  if (!local) {
    return { draft: memoryDraft, storageAvailable: false };
  }
  try {
    const raw = local.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return { draft: memoryDraft, storageAvailable: true };
    const parsed = JSON.parse(raw) as ProjectDraft;
    if (!parsed || parsed.schemaVersion !== 1 || !parsed.brief) {
      // Do NOT silently delete incompatible data; expose raw text for optional user backup
      return { draft: null, storageAvailable: true, incompatibleRaw: raw };
    }
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
      local.removeItem(DRAFT_STORAGE_KEY);
      return { draft: null, storageAvailable: true };
    }
    memoryDraft = parsed;
    return { draft: parsed, storageAvailable: true };
  } catch {
    const raw = local.getItem(DRAFT_STORAGE_KEY);
    return { draft: memoryDraft, storageAvailable: true, incompatibleRaw: raw || null };
  }
}

export function clearProjectDraft(): void {
  memoryDraft = null;
  memoryStarter = null;
  const local = getSafeStorage("local");
  if (local) {
    try {
      local.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(DRAFT_UPDATED_EVENT, { detail: null }));
  }
}

export function hasSavedDraft(): boolean {
  const { draft } = loadProjectDraft();
  return Boolean(draft && (draft.brief.idea || draft.messages.length > 0));
}

export function subscribeDraftChanges(listener: (draft: ProjectDraft | null) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onCustom = (ev: Event) => {
    const detail = (ev as CustomEvent<ProjectDraft | null>).detail ?? null;
    listener(detail);
  };
  const onStorage = (ev: StorageEvent) => {
    if (ev.key === DRAFT_STORAGE_KEY) {
      const { draft } = loadProjectDraft();
      listener(draft);
    }
  };
  window.addEventListener(DRAFT_UPDATED_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(DRAFT_UPDATED_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

export function getContextualHintState(): { shown: boolean; dismissed: boolean } {
  const session = getSafeStorage("session");
  if (!session) return { shown: Boolean(memoryHintState.shown), dismissed: Boolean(memoryHintState.dismissed) };
  try {
    const raw = session.getItem(CONTEXTUAL_HINT_KEY);
    if (!raw) return { shown: false, dismissed: false };
    const parsed = JSON.parse(raw) as { shown?: boolean; dismissed?: boolean };
    return { shown: Boolean(parsed.shown), dismissed: Boolean(parsed.dismissed) };
  } catch {
    return { shown: false, dismissed: false };
  }
}

export function setContextualHintState(update: { shown?: boolean; dismissed?: boolean }): void {
  const current = getContextualHintState();
  const next = {
    shown: update.shown ?? current.shown,
    dismissed: update.dismissed ?? current.dismissed
  };
  memoryHintState = next;
  const session = getSafeStorage("session");
  if (session) {
    try {
      session.setItem(CONTEXTUAL_HINT_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
}
