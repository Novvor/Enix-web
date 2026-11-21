import {
  defaultDevCoordinator,
  type CoordinatorStore
} from "./assistant-guard.ts";
import { UpstashRedisCoordinatorStore } from "./upstash-redis-store.ts";

let cachedUpstashStore: UpstashRedisCoordinatorStore | null = null;
let cachedUpstashFingerprint = "";

export interface RuntimeStoreResolution {
  isProduction: boolean;
  coordinator: CoordinatorStore | null;
  sharedStoreConfigured: boolean;
  backendName: string;
}

export function detectProductionRuntime(env: Record<string, unknown> = {}): boolean {
  const vercelEnv = String(env.VERCEL_ENV ?? process.env.VERCEL_ENV ?? "").toLowerCase();
  if (vercelEnv === "production") return true;
  if (vercelEnv === "preview" || vercelEnv === "development") return false;

  const nodeEnv = String(env.NODE_ENV ?? process.env.NODE_ENV ?? "").toLowerCase();
  if (nodeEnv === "production") return true;
  if (env.PROD === true) return true;
  return false;
}

/**
 * Resolves the active CoordinatorStore.
 * - Production: strictly requires shared persistent storage (Upstash Redis via REST Lua EVAL).
 *   Never falls back silently to InMemoryCoordinatorStore.
 * - Development / Preview: uses Upstash Redis if configured, else InMemoryCoordinatorStore.
 */
export function resolveRuntimeCoordinator(
  env: Record<string, unknown> = {}
): RuntimeStoreResolution {
  const isProduction = detectProductionRuntime(env);
  const upstashUrl = String(
    env.UPSTASH_REDIS_REST_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? ""
  ).trim();
  const upstashToken = String(
    env.UPSTASH_REDIS_REST_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? ""
  ).trim();

  if (upstashUrl && upstashToken) {
    const fp = `${upstashUrl}::${upstashToken.length}`;
    if (!cachedUpstashStore || cachedUpstashFingerprint !== fp) {
      cachedUpstashStore = new UpstashRedisCoordinatorStore({
        url: upstashUrl,
        token: upstashToken
      });
      cachedUpstashFingerprint = fp;
    }
    return {
      isProduction,
      coordinator: cachedUpstashStore,
      sharedStoreConfigured: true,
      backendName: cachedUpstashStore.backendName
    };
  }

  if (isProduction) {
    return {
      isProduction: true,
      coordinator: null,
      sharedStoreConfigured: false,
      backendName: "unconfigured_in_production"
    };
  }

  return {
    isProduction: false,
    coordinator: defaultDevCoordinator,
    sharedStoreConfigured: false,
    backendName: defaultDevCoordinator.backendName
  };
}
