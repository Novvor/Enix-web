import { DatabaseSync } from "node:sqlite";
import {
  LIMITS,
  getSantiagoDateKeys,
  type AcquireIdempotencyResult,
  type CoordinatorStore,
  type ReservationHandle,
  type ReservationResult,
  type SessionHistoryEntry
} from "./assistant-guard.ts";
import { StoreUnavailableError } from "./upstash-redis-store.ts";
import type { AssistantTurnResponse } from "../project/schema.ts";

/**
 * Persistent atomic CoordinatorStore backed by SQLite (WAL + BEGIN IMMEDIATE).
 * Designed for isolated multi-instance testing and local persistent verification
 * where two independent coordinator instances share the exact same database file.
 */
export class SqliteCoordinatorStore implements CoordinatorStore {
  public readonly isDistributed = true;
  public readonly backendName = "sqlite-wal";

  private db: DatabaseSync;
  private closed = false;
  private readonly limits: {
    rateLimitPerMinutePerSession: number;
    maxConcurrentPerSession: number;
    maxConcurrentGlobal: number;
    maxPaidTurnsPerSession24h: number;
    sessionBudgetMicrocents: number;
    dailyBudgetMicrocents: number;
    monthlyBudgetMicrocents: number;
  };

  constructor(
    dbPath: string,
    overrides: Partial<Record<keyof typeof LIMITS, number>> = {}
  ) {
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA busy_timeout = 5000;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS idempotency (
        session_id TEXT NOT NULL,
        request_id TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        response_json TEXT,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (session_id, request_id)
      );
      CREATE TABLE IF NOT EXISTS rate_limits (
        session_id TEXT PRIMARY KEY,
        window_start INTEGER NOT NULL,
        count INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        day_window_start INTEGER NOT NULL,
        paid_turns_24h INTEGER NOT NULL,
        spent_24h INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS reservations (
        reservation_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        day_key TEXT NOT NULL,
        month_key TEXT NOT NULL,
        reserved_microcents INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ledger (
        bucket_key TEXT PRIMARY KEY,
        spent_microcents INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS session_history (
        session_id TEXT PRIMARY KEY,
        history_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    this.limits = {
      rateLimitPerMinutePerSession:
        overrides.rateLimitPerMinutePerSession ?? LIMITS.rateLimitPerMinutePerSession,
      maxConcurrentPerSession:
        overrides.maxConcurrentPerSession ?? LIMITS.maxConcurrentPerSession,
      maxConcurrentGlobal:
        overrides.maxConcurrentGlobal ?? LIMITS.maxConcurrentGlobal,
      maxPaidTurnsPerSession24h:
        overrides.maxPaidTurnsPerSession24h ?? LIMITS.maxPaidTurnsPerSession24h,
      sessionBudgetMicrocents:
        overrides.sessionBudgetMicrocents ?? LIMITS.sessionBudgetMicrocents,
      dailyBudgetMicrocents:
        overrides.dailyBudgetMicrocents ?? LIMITS.dailyBudgetMicrocents,
      monthlyBudgetMicrocents:
        overrides.monthlyBudgetMicrocents ?? LIMITS.monthlyBudgetMicrocents
    };
  }

  private ensureOpen() {
    if (this.closed) {
      throw new StoreUnavailableError("sqlite_closed");
    }
  }

  private withImmediateTx<T>(fn: () => T): T {
    this.ensureOpen();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (err) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  }

  public async acquireIdempotency(
    sessionId: string,
    requestId: string,
    contentHash: string,
    nowMs = Date.now()
  ): Promise<AcquireIdempotencyResult> {
    return this.withImmediateTx(() => {
      const row = this.db
        .prepare(
          "SELECT content_hash, status, response_json, created_at FROM idempotency WHERE session_id = ? AND request_id = ?"
        )
        .get(sessionId, requestId) as
        | { content_hash: string; status: string; response_json: string | null; created_at: number }
        | undefined;

      if (row && nowMs - row.created_at <= LIMITS.idempotencyTtlMs) {
        if (row.content_hash !== contentHash) return { status: "conflict" };
        if (row.status === "in_flight") return { status: "in_flight" };
        if (row.status === "completed" && row.response_json) {
          return {
            status: "replay",
            response: JSON.parse(row.response_json) as AssistantTurnResponse
          };
        }
      }

      this.db
        .prepare(
          `INSERT OR REPLACE INTO idempotency (session_id, request_id, content_hash, status, response_json, created_at)
           VALUES (?, ?, ?, 'in_flight', NULL, ?)`
        )
        .run(sessionId, requestId, contentHash, nowMs);

      return { status: "acquired" };
    });
  }

  public async completeIdempotency(
    sessionId: string,
    requestId: string,
    contentHash: string,
    response: AssistantTurnResponse
  ): Promise<void> {
    this.withImmediateTx(() => {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO idempotency (session_id, request_id, content_hash, status, response_json, created_at)
           VALUES (?, ?, ?, 'completed', ?, ?)`
        )
        .run(sessionId, requestId, contentHash, JSON.stringify(response), Date.now());
    });
  }

  public async releaseIdempotency(sessionId: string, requestId: string): Promise<void> {
    this.withImmediateTx(() => {
      this.db
        .prepare("DELETE FROM idempotency WHERE session_id = ? AND request_id = ?")
        .run(sessionId, requestId);
    });
  }

  public async checkRateLimit(sessionId: string, nowMs = Date.now()): Promise<boolean> {
    return this.withImmediateTx(() => {
      const row = this.db
        .prepare("SELECT window_start, count FROM rate_limits WHERE session_id = ?")
        .get(sessionId) as { window_start: number; count: number } | undefined;

      if (!row || nowMs - row.window_start >= 60_000) {
        this.db
          .prepare("INSERT OR REPLACE INTO rate_limits (session_id, window_start, count) VALUES (?, ?, 1)")
          .run(sessionId, nowMs);
        return true;
      }

      if (row.count >= this.limits.rateLimitPerMinutePerSession) {
        return false;
      }

      this.db
        .prepare("UPDATE rate_limits SET count = count + 1 WHERE session_id = ?")
        .run(sessionId);
      return true;
    });
  }

  private getLedger(bucketKey: string): number {
    const row = this.db
      .prepare("SELECT spent_microcents FROM ledger WHERE bucket_key = ?")
      .get(bucketKey) as { spent_microcents: number } | undefined;
    return row ? Number(row.spent_microcents) : 0;
  }

  private addLedger(bucketKey: string, delta: number): void {
    const next = Math.max(0, this.getLedger(bucketKey) + delta);
    this.db
      .prepare("INSERT OR REPLACE INTO ledger (bucket_key, spent_microcents) VALUES (?, ?)")
      .run(bucketKey, next);
  }

  public async tryReserve(
    sessionId: string,
    estimatedMicrocents: number,
    now = new Date()
  ): Promise<ReservationResult> {
    const nowMs = now.getTime();
    const { dayKey, monthKey } = getSantiagoDateKeys(now);
    const leaseExpiresAt = nowMs + LIMITS.providerTimeoutMs + 45_000;

    return this.withImmediateTx(() => {
      // Purge expired active reservation leases (crashed workers) without refunding ledger spend
      this.db.prepare("DELETE FROM reservations WHERE expires_at <= ?").run(nowMs);

      const sessInFlight = (
        this.db
          .prepare("SELECT COUNT(*) as c FROM reservations WHERE session_id = ?")
          .get(sessionId) as { c: number }
      ).c;
      if (sessInFlight >= this.limits.maxConcurrentPerSession) {
        return { ok: false, reason: "session_busy" };
      }

      const globalInFlight = (
        this.db.prepare("SELECT COUNT(*) as c FROM reservations").get() as { c: number }
      ).c;
      if (globalInFlight >= this.limits.maxConcurrentGlobal) {
        return { ok: false, reason: "global_busy" };
      }

      let sess = this.db
        .prepare("SELECT day_window_start, paid_turns_24h, spent_24h FROM sessions WHERE session_id = ?")
        .get(sessionId) as
        | { day_window_start: number; paid_turns_24h: number; spent_24h: number }
        | undefined;

      if (!sess || nowMs - sess.day_window_start >= 24 * 60 * 60 * 1000) {
        sess = { day_window_start: nowMs, paid_turns_24h: 0, spent_24h: 0 };
      }

      if (sess.paid_turns_24h >= this.limits.maxPaidTurnsPerSession24h) {
        return { ok: false, reason: "session_turn_cap" };
      }
      if (sess.spent_24h + estimatedMicrocents > this.limits.sessionBudgetMicrocents) {
        return { ok: false, reason: "session_budget" };
      }

      const dailyKey = `daily:${dayKey}`;
      const monthlyKey = `monthly:${monthKey}`;
      const curDaily = this.getLedger(dailyKey);
      const curMonthly = this.getLedger(monthlyKey);

      if (curDaily + estimatedMicrocents > this.limits.dailyBudgetMicrocents) {
        return { ok: false, reason: "daily_budget" };
      }
      if (curMonthly + estimatedMicrocents > this.limits.monthlyBudgetMicrocents) {
        return { ok: false, reason: "monthly_budget" };
      }

      // Atomic commit of reservation + session + global ledgers
      const reservationId = `${sessionId}-${nowMs.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      this.db
        .prepare(
          `INSERT INTO reservations (reservation_id, session_id, day_key, month_key, reserved_microcents, expires_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(reservationId, sessionId, dayKey, monthKey, estimatedMicrocents, leaseExpiresAt);

      this.db
        .prepare(
          `INSERT OR REPLACE INTO sessions (session_id, day_window_start, paid_turns_24h, spent_24h)
           VALUES (?, ?, ?, ?)`
        )
        .run(
          sessionId,
          sess.day_window_start,
          sess.paid_turns_24h + 1,
          sess.spent_24h + estimatedMicrocents
        );

      this.addLedger(dailyKey, estimatedMicrocents);
      this.addLedger(monthlyKey, estimatedMicrocents);

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
    });
  }

  public async reconcile(
    handle: ReservationHandle,
    actualMicrocents: number | null,
    countPaidTurn: boolean
  ): Promise<void> {
    this.withImmediateTx(() => {
      const existing = this.db
        .prepare("SELECT reservation_id FROM reservations WHERE reservation_id = ?")
        .get(handle.reservationId);
      if (!existing) return;

      this.db
        .prepare("DELETE FROM reservations WHERE reservation_id = ?")
        .run(handle.reservationId);

      // Uncertain usage (timeout / error): retain conservative reservation, record uncertain metric
      if (actualMicrocents === null) {
        this.addLedger(`uncertain:${handle.dayKey}`, handle.reservedMicrocents);
        return;
      }

      const delta = actualMicrocents - handle.reservedMicrocents;
      if (delta !== 0) {
        const sess = this.db
          .prepare("SELECT day_window_start, paid_turns_24h, spent_24h FROM sessions WHERE session_id = ?")
          .get(handle.sessionId) as
          | { day_window_start: number; paid_turns_24h: number; spent_24h: number }
          | undefined;
        if (sess) {
          this.db
            .prepare("UPDATE sessions SET spent_24h = ?, paid_turns_24h = ? WHERE session_id = ?")
            .run(
              Math.max(0, sess.spent_24h + delta),
              countPaidTurn ? sess.paid_turns_24h : Math.max(0, sess.paid_turns_24h - 1),
              handle.sessionId
            );
        }
        this.addLedger(`daily:${handle.dayKey}`, delta);
        this.addLedger(`monthly:${handle.monthKey}`, delta);
      }
    });
  }

  public getDiagnostics() {
    this.ensureOpen();
    const activeReservations = (
      this.db.prepare("SELECT COUNT(*) as c FROM reservations").get() as { c: number }
    ).c;
    const rows = this.db
      .prepare("SELECT bucket_key, spent_microcents FROM ledger")
      .all() as { bucket_key: string; spent_microcents: number }[];
    const ledger: Record<string, number> = {};
    for (const r of rows) ledger[r.bucket_key] = Number(r.spent_microcents);
    return { activeReservations, ledger };
  }

  public async getSessionHistory(sessionId: string): Promise<SessionHistoryEntry[]> {
    this.ensureOpen();
    const row = this.db
      .prepare("SELECT history_json FROM session_history WHERE session_id = ?")
      .get(sessionId) as { history_json: string } | undefined;
    if (!row) return [];
    try {
      const parsed = JSON.parse(row.history_json) as unknown;
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
    this.ensureOpen();
    const current = await this.getSessionHistory(sessionId);
    const next: SessionHistoryEntry[] = [
      ...current,
      { role: "user", text: userText.slice(0, 600) },
      { role: "assistant", text: assistantText.slice(0, 800) }
    ].slice(-16);
    this.db
      .prepare(
        "INSERT OR REPLACE INTO session_history (session_id, history_json, updated_at) VALUES (?, ?, ?)"
      )
      .run(sessionId, JSON.stringify(next), Date.now());
  }

  public close(): void {
    if (!this.closed) {
      this.closed = true;
      this.db.close();
    }
  }
}
