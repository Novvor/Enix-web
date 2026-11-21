import type { ProjectDraft } from "./schema";

const DRAFT_STORAGE_KEY = "enix.v2.projectDraft.v1";
const STARTER_IDEA_KEY = "enix.v2.starterIdea.v1";
const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

let memoryDraft: ProjectDraft | null = null;
let memoryStarter: { idea: string; category?: string | null; demo?: string | null; createdAt: string } | null = null;

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

export function saveStarterIdea(idea: string, category?: string | null, demo?: string | null): boolean {
  const payload: StarterIdeaPayload = {
    idea: idea.trim().slice(0, 1200),
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

  const local = getSafeStorage("local");
  if (!local) return false;
  try {
    local.setItem(DRAFT_STORAGE_KEY, JSON.stringify(fullDraft));
    return true;
  } catch {
    return false;
  }
}

export function loadProjectDraft(): { draft: ProjectDraft | null; storageAvailable: boolean } {
  const local = getSafeStorage("local");
  if (!local) {
    return { draft: memoryDraft, storageAvailable: false };
  }
  try {
    const raw = local.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return { draft: memoryDraft, storageAvailable: true };
    const parsed = JSON.parse(raw) as ProjectDraft;
    if (!parsed || parsed.schemaVersion !== 1 || !parsed.brief) {
      local.removeItem(DRAFT_STORAGE_KEY);
      return { draft: null, storageAvailable: true };
    }
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
      local.removeItem(DRAFT_STORAGE_KEY);
      return { draft: null, storageAvailable: true };
    }
    memoryDraft = parsed;
    return { draft: parsed, storageAvailable: true };
  } catch {
    return { draft: memoryDraft, storageAvailable: true };
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
}

export function hasSavedDraft(): boolean {
  const { draft } = loadProjectDraft();
  return Boolean(draft && (draft.brief.idea || draft.messages.length > 1));
}
