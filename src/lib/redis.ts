import { Redis } from "@upstash/redis";

let cachedClient: Redis | null = null;

/**
 * Shared Upstash Redis client (HTTP/REST — safe for Vercel serverless).
 * Reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from Astro/Node env.
 */
export function getRedisClient(): Redis | null {
  const url = String(
    import.meta.env?.UPSTASH_REDIS_REST_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? ""
  ).trim();
  const token = String(
    import.meta.env?.UPSTASH_REDIS_REST_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? ""
  ).trim();

  if (!url || !token) return null;

  if (!cachedClient) {
    cachedClient = new Redis({ url, token });
  }
  return cachedClient;
}

export const redis = getRedisClient();
