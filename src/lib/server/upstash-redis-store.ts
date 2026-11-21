import {
  LIMITS,
  getSantiagoDateKeys,
  type AcquireIdempotencyResult,
  type CoordinatorStore,
  type ReservationHandle,
  type ReservationResult,
  type SessionHistoryEntry
} from "./assistant-guard.ts";
import type { AssistantTurnResponse } from "../project/schema.ts";

export class StoreUnavailableError extends Error {
  public readonly reason: string;
  constructor(reason: string, message?: string) {
    super(message || `Persistent coordinator store unavailable: ${reason}`);
    this.name = "StoreUnavailableError";
    this.reason = reason;
  }
}

export interface UpstashRedisConfig {
  url: string;
  token: string;
  keyPrefix?: string;
  timeoutMs?: number;
  limits?: Partial<Record<keyof typeof LIMITS, number>>;
}

/**
 * Atomic Lua script #1: Idempotency acquire.
 * KEYS[1] = idem key
 * ARGV[1] = contentHash
 * ARGV[2] = ttlMs
 * ARGV[3] = nowMs
 * Returns:
 *   {"acquired"}
 *   {"conflict"}
 *   {"in_flight"}
 *   {"replay", serializedResponse}
 */
const LUA_ACQUIRE_IDEMPOTENCY = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  local payload = cjson.encode({ status = 'in_flight', contentHash = ARGV[1], createdAt = tonumber(ARGV[3]) })
  redis.call('SET', KEYS[1], payload, 'PX', tonumber(ARGV[2]))
  return { 'acquired' }
end
local rec = cjson.decode(raw)
if rec.contentHash ~= ARGV[1] then
  return { 'conflict' }
end
if rec.status == 'in_flight' then
  return { 'in_flight' }
end
return { 'replay', cjson.encode(rec.response) }
`;

/**
 * Atomic Lua script #2: Per-session 60-second rate limit.
 * KEYS[1] = rate key
 * ARGV[1] = maxPerMinute
 * ARGV[2] = windowMs (60000)
 * Returns: 1 if allowed, 0 if rate-limited
 */
const LUA_CHECK_RATE_LIMIT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current >= tonumber(ARGV[1]) then
  return 0
end
local nextVal = redis.call('INCR', KEYS[1])
if nextVal == 1 then
  redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[2]))
end
return 1
`;

/**
 * Atomic Lua script #3: Check all concurrency + budget caps and reserve atomically.
 * KEYS[1] = session inFlight key
 * KEYS[2] = global inFlight key
 * KEYS[3] = session 24h paid turns key
 * KEYS[4] = session 24h spent microcents key
 * KEYS[5] = daily spent microcents key
 * KEYS[6] = monthly spent microcents key
 * KEYS[7] = reservation lease key
 *
 * ARGV[1] = estimatedMicrocents
 * ARGV[2] = maxConcurrentPerSession
 * ARGV[3] = maxConcurrentGlobal
 * ARGV[4] = maxPaidTurns24h
 * ARGV[5] = sessionBudgetMicrocents
 * ARGV[6] = dailyBudgetMicrocents
 * ARGV[7] = monthlyBudgetMicrocents
 * ARGV[8] = leaseTtlMs (e.g. 90000)
 * ARGV[9] = reservationPayloadJson
 */
const LUA_TRY_RESERVE = `
local est = tonumber(ARGV[1])
local sInFlight = tonumber(redis.call('GET', KEYS[1]) or '0')
if sInFlight >= tonumber(ARGV[2]) then return { 'err', 'session_busy' } end

local gInFlight = tonumber(redis.call('GET', KEYS[2]) or '0')
if gInFlight >= tonumber(ARGV[3]) then return { 'err', 'global_busy' } end

local sTurns = tonumber(redis.call('GET', KEYS[3]) or '0')
if sTurns >= tonumber(ARGV[4]) then return { 'err', 'session_turn_cap' } end

local sSpent = tonumber(redis.call('GET', KEYS[4]) or '0')
if sSpent + est > tonumber(ARGV[5]) then return { 'err', 'session_budget' } end

local dSpent = tonumber(redis.call('GET', KEYS[5]) or '0')
if dSpent + est > tonumber(ARGV[6]) then return { 'err', 'daily_budget' } end

local mSpent = tonumber(redis.call('GET', KEYS[6]) or '0')
if mSpent + est > tonumber(ARGV[7]) then return { 'err', 'monthly_budget' } end

-- All checks passed: commit atomically
local ns = redis.call('INCR', KEYS[1])
redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[8]))
local ng = redis.call('INCR', KEYS[2])
redis.call('PEXPIRE', KEYS[2], tonumber(ARGV[8]))

local nt = redis.call('INCR', KEYS[3])
if nt == 1 then redis.call('EXPIRE', KEYS[3], 86400) end

local nss = redis.call('INCRBY', KEYS[4], est)
if nss == est then redis.call('EXPIRE', KEYS[4], 86400) end

local nds = redis.call('INCRBY', KEYS[5], est)
if nds == est then redis.call('EXPIRE', KEYS[5], 172800) end

local nms = redis.call('INCRBY', KEYS[6], est)
if nms == est then redis.call('EXPIRE', KEYS[6], 3024000) end

redis.call('SET', KEYS[7], ARGV[9], 'PX', tonumber(ARGV[8]))
return { 'ok' }
`;

/**
 * Atomic Lua script #4: Reconcile reservation idempotently.
 * KEYS[1] = session inFlight key
 * KEYS[2] = global inFlight key
 * KEYS[3] = session 24h paid turns key
 * KEYS[4] = session 24h spent microcents key
 * KEYS[5] = daily spent microcents key
 * KEYS[6] = monthly spent microcents key
 * KEYS[7] = reservation lease key
 * KEYS[8] = daily uncertain microcents key
 *
 * ARGV[1] = reservedMicrocents
 * ARGV[2] = actualMicrocents (or '-1' if uncertain/timeout)
 * ARGV[3] = countPaidTurn ('1' or '0')
 */
const LUA_RECONCILE = `
local lease = redis.call('GET', KEYS[7])
if not lease then
  return 0
end
redis.call('DEL', KEYS[7])

local sIn = tonumber(redis.call('GET', KEYS[1]) or '0')
if sIn > 0 then redis.call('DECR', KEYS[1]) end

local gIn = tonumber(redis.call('GET', KEYS[2]) or '0')
if gIn > 0 then redis.call('DECR', KEYS[2]) end

local actual = tonumber(ARGV[2])
local reserved = tonumber(ARGV[1])
if actual < 0 then
  -- Uncertain usage (timeout/error): retain conservative reservation and record uncertain metric
  local nu = redis.call('INCRBY', KEYS[8], reserved)
  if nu == reserved then redis.call('EXPIRE', KEYS[8], 172800) end
  return 1
end

local delta = actual - reserved
if delta ~= 0 then
  local sNew = math.max(0, tonumber(redis.call('GET', KEYS[4]) or '0') + delta)
  redis.call('SET', KEYS[4], tostring(sNew), 'KEEPTTL')

  local dNew = math.max(0, tonumber(redis.call('GET', KEYS[5]) or '0') + delta)
  redis.call('SET', KEYS[5], tostring(dNew), 'KEEPTTL')

  local mNew = math.max(0, tonumber(redis.call('GET', KEYS[6]) or '0') + delta)
  redis.call('SET', KEYS[6], tostring(mNew), 'KEEPTTL')
end

if ARGV[3] == '0' then
  local tCur = tonumber(redis.call('GET', KEYS[3]) or '0')
  if tCur > 0 then redis.call('DECR', KEYS[3]) end
end

return 1
`;

export class UpstashRedisCoordinatorStore implements CoordinatorStore {
  public readonly isDistributed = true;
  public readonly backendName = "upstash-redis";

  private readonly url: string;
  private readonly token: string;
  private readonly prefix: string;
  private readonly timeoutMs: number;
  private readonly limits: {
    rateLimitPerMinutePerSession: number;
    maxConcurrentPerSession: number;
    maxConcurrentGlobal: number;
    maxPaidTurnsPerSession24h: number;
    sessionBudgetMicrocents: number;
    dailyBudgetMicrocents: number;
    monthlyBudgetMicrocents: number;
  };

  constructor(config: UpstashRedisConfig) {
    this.url = config.url.replace(/\/+$/, "");
    this.token = config.token;
    this.prefix = config.keyPrefix || "enix:v2:assistant";
    this.timeoutMs = config.timeoutMs ?? 3500;
    const o = config.limits || {};
    this.limits = {
      rateLimitPerMinutePerSession:
        o.rateLimitPerMinutePerSession ?? LIMITS.rateLimitPerMinutePerSession,
      maxConcurrentPerSession:
        o.maxConcurrentPerSession ?? LIMITS.maxConcurrentPerSession,
      maxConcurrentGlobal:
        o.maxConcurrentGlobal ?? LIMITS.maxConcurrentGlobal,
      maxPaidTurnsPerSession24h:
        o.maxPaidTurnsPerSession24h ?? LIMITS.maxPaidTurnsPerSession24h,
      sessionBudgetMicrocents:
        o.sessionBudgetMicrocents ?? LIMITS.sessionBudgetMicrocents,
      dailyBudgetMicrocents:
        o.dailyBudgetMicrocents ?? LIMITS.dailyBudgetMicrocents,
      monthlyBudgetMicrocents:
        o.monthlyBudgetMicrocents ?? LIMITS.monthlyBudgetMicrocents
    };
  }

  private k(part: string): string {
    return `${this.prefix}:${part}`;
  }

  private async execCommand<T = unknown>(command: unknown[]): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(command)
      });

      if (!res.ok) {
        throw new StoreUnavailableError(`upstash_http_${res.status}`);
      }

      const data = (await res.json()) as { result?: T; error?: string };
      if (data.error) {
        throw new StoreUnavailableError("upstash_redis_error", data.error);
      }
      return data.result as T;
    } catch (err) {
      if (err instanceof StoreUnavailableError) throw err;
      throw new StoreUnavailableError("upstash_network_or_timeout");
    } finally {
      clearTimeout(timer);
    }
  }

  public async acquireIdempotency(
    sessionId: string,
    requestId: string,
    contentHash: string,
    nowMs = Date.now()
  ): Promise<AcquireIdempotencyResult> {
    const key = this.k(`idem:${sessionId}:${requestId}`);
    const res = await this.execCommand<string[]>([
      "EVAL",
      LUA_ACQUIRE_IDEMPOTENCY,
      1,
      key,
      contentHash,
      LIMITS.idempotencyTtlMs,
      nowMs
    ]);

    const status = res?.[0];
    if (status === "acquired") return { status: "acquired" };
    if (status === "conflict") return { status: "conflict" };
    if (status === "in_flight") return { status: "in_flight" };
    if (status === "replay" && typeof res[1] === "string") {
      return { status: "replay", response: JSON.parse(res[1]) as AssistantTurnResponse };
    }
    throw new StoreUnavailableError("upstash_invalid_idempotency_reply");
  }

  public async completeIdempotency(
    sessionId: string,
    requestId: string,
    contentHash: string,
    response: AssistantTurnResponse
  ): Promise<void> {
    const key = this.k(`idem:${sessionId}:${requestId}`);
    const payload = JSON.stringify({
      status: "completed",
      contentHash,
      response,
      createdAt: Date.now()
    });
    await this.execCommand(["SET", key, payload, "PX", LIMITS.idempotencyTtlMs]);
  }

  public async releaseIdempotency(sessionId: string, requestId: string): Promise<void> {
    const key = this.k(`idem:${sessionId}:${requestId}`);
    await this.execCommand(["DEL", key]);
  }

  public async checkRateLimit(sessionId: string): Promise<boolean> {
    const key = this.k(`rate:${sessionId}`);
    const allowed = await this.execCommand<number>([
      "EVAL",
      LUA_CHECK_RATE_LIMIT,
      1,
      key,
      this.limits.rateLimitPerMinutePerSession,
      60_000
    ]);
    return Number(allowed) === 1;
  }

  public async tryReserve(
    sessionId: string,
    estimatedMicrocents: number,
    now = new Date()
  ): Promise<ReservationResult> {
    const { dayKey, monthKey } = getSantiagoDateKeys(now);
    const reservationId = `${sessionId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const leaseTtlMs = LIMITS.providerTimeoutMs + 45_000;

    const res = await this.execCommand<string[]>([
      "EVAL",
      LUA_TRY_RESERVE,
      7,
      this.k(`inflight:sess:${sessionId}`),
      this.k("inflight:global"),
      this.k(`turns24h:${sessionId}`),
      this.k(`spent24h:${sessionId}`),
      this.k(`daily:${dayKey}`),
      this.k(`monthly:${monthKey}`),
      this.k(`lease:${reservationId}`),
      estimatedMicrocents,
      this.limits.maxConcurrentPerSession,
      this.limits.maxConcurrentGlobal,
      this.limits.maxPaidTurnsPerSession24h,
      this.limits.sessionBudgetMicrocents,
      this.limits.dailyBudgetMicrocents,
      this.limits.monthlyBudgetMicrocents,
      leaseTtlMs,
      JSON.stringify({ sessionId, dayKey, monthKey, reservedMicrocents: estimatedMicrocents })
    ]);

    if (res?.[0] === "ok") {
      return {
        ok: true,
        handle: {
          reservationId,
          sessionId,
          dayKey,
          monthKey,
          reservedMicrocents: estimatedMicrocents
        }
      };
    }

    const reason = (res?.[1] || "global_busy") as Extract<ReservationResult, { ok: false }>["reason"];
    return { ok: false, reason };
  }

  public async reconcile(
    handle: ReservationHandle,
    actualMicrocents: number | null,
    countPaidTurn: boolean
  ): Promise<void> {
    await this.execCommand([
      "EVAL",
      LUA_RECONCILE,
      8,
      this.k(`inflight:sess:${handle.sessionId}`),
      this.k("inflight:global"),
      this.k(`turns24h:${handle.sessionId}`),
      this.k(`spent24h:${handle.sessionId}`),
      this.k(`daily:${handle.dayKey}`),
      this.k(`monthly:${handle.monthKey}`),
      this.k(`lease:${handle.reservationId}`),
      this.k(`uncertain:${handle.dayKey}`),
      handle.reservedMicrocents,
      actualMicrocents === null ? -1 : actualMicrocents,
      countPaidTurn ? "1" : "0"
    ]);
  }

  public async getSessionHistory(sessionId: string): Promise<SessionHistoryEntry[]> {
    try {
      const raw = await this.execCommand<string | null>(["GET", this.k(`hist:${sessionId}`)]);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (item): item is SessionHistoryEntry =>
            Boolean(
              item &&
                typeof item === "object" &&
                ((item as SessionHistoryEntry).role === "user" ||
                  (item as SessionHistoryEntry).role === "assistant") &&
                typeof (item as SessionHistoryEntry).text === "string"
            )
        )
        .slice(-16);
    } catch {
      return [];
    }
  }

  public async appendSessionTurn(
    sessionId: string,
    userText: string,
    assistantText: string
  ): Promise<void> {
    try {
      const current = await this.getSessionHistory(sessionId);
      const next: SessionHistoryEntry[] = [
        ...current,
        { role: "user" as const, text: userText.slice(0, 600) },
        { role: "assistant" as const, text: assistantText.slice(0, 800) }
      ].slice(-16);
      await this.execCommand(["SET", this.k(`hist:${sessionId}`), JSON.stringify(next), "EX", 86400]);
    } catch {
      // Non-fatal: history persistence failure should never block an already completed turn
    }
  }
}
