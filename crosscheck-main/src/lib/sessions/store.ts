/**
 * Session + debrief persistence. Defaults to in-memory; swaps to Drizzle/Neon
 * automatically when DATABASE_URL is configured AND a userId is supplied
 * (anonymous demos always use in-memory).
 *
 * Module-level Map persists across requests within a single Node process.
 * Will not survive Vercel cold starts — that's why DB-backed mode exists.
 */

import type { ScenarioEvent } from "@/engine/events";
import type { ScenarioState } from "@/engine/state";
import { isDbConfigured, db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export type StoredSession = {
  id: string;
  scenarioSlug: string;
  startedAt: number;
  endedAt: number;
  events: ScenarioEvent[];
  finalState: ScenarioState;
  /** Optional Clerk user ID — when present and DB is configured, persists */
  userId?: string | null;
};

export type DebriefRubric = {
  correctness: { score: number; evidence: string };
  sequence: { score: number; evidence: string };
  decision: { score: number; evidence: string };
};

export type StoredDebrief = {
  id: string;
  sessionId: string;
  rubric: DebriefRubric;
  compositeScore: number;
  narrative: string;
  createdAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __crosscheckSessions: Map<string, StoredSession> | undefined;
  // eslint-disable-next-line no-var
  var __crosscheckDebriefs: Map<string, StoredDebrief> | undefined;
}

const memSessions = (globalThis.__crosscheckSessions ??= new Map<
  string,
  StoredSession
>());
const memDebriefs = (globalThis.__crosscheckDebriefs ??= new Map<
  string,
  StoredDebrief
>());

const usingDb = (s: { userId?: string | null }) =>
  isDbConfigured && !!db && !!s.userId;

async function ensureUser(clerkId: string): Promise<string> {
  if (!db) throw new Error("DB not configured");
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.clerkId, clerkId))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const inserted = await db
    .insert(schema.users)
    .values({ clerkId, email: `${clerkId}@unknown.local` })
    .returning();
  return inserted[0].id;
}

async function ensureScenario(slug: string): Promise<string> {
  if (!db) throw new Error("DB not configured");
  const existing = await db
    .select()
    .from(schema.scenarios)
    .where(eq(schema.scenarios.slug, slug))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const inserted = await db
    .insert(schema.scenarios)
    .values({ slug, title: slug, definition: {} })
    .returning();
  return inserted[0].id;
}

export async function saveSession(s: StoredSession): Promise<void> {
  if (usingDb(s) && db) {
    try {
      const userRowId = await ensureUser(s.userId!);
      const scenarioRowId = await ensureScenario(s.scenarioSlug);
      await db.insert(schema.sessions).values({
        id: s.id,
        userId: userRowId,
        scenarioId: scenarioRowId,
        scenarioVersion: 1,
        status: "completed",
        startedAt: new Date(s.startedAt),
        endedAt: new Date(s.endedAt),
      });
      if (s.events.length > 0) {
        await db.insert(schema.sessionEvents).values(
          s.events.map((e) => ({
            sessionId: s.id,
            tMs: Math.round(e.tMs),
            kind: "action" as const,
            payload: e,
          })),
        );
      }
      return;
    } catch (err) {
      console.warn("[sessions] DB write failed, falling back to memory:", err);
    }
  }
  memSessions.set(s.id, s);
}

export async function getSession(id: string): Promise<StoredSession | undefined> {
  // Always check memory first (covers anonymous demos)
  const mem = memSessions.get(id);
  if (mem) return mem;
  if (!isDbConfigured || !db) return undefined;
  try {
    const row = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, id))
      .limit(1);
    if (!row[0]) return undefined;
    const events = await db
      .select()
      .from(schema.sessionEvents)
      .where(eq(schema.sessionEvents.sessionId, id))
      .orderBy(schema.sessionEvents.tMs);
    const r = row[0];
    return {
      id: r.id,
      scenarioSlug: "",
      startedAt: r.startedAt.getTime(),
      endedAt: r.endedAt?.getTime() ?? Date.now(),
      events: events.map((e) => e.payload as ScenarioEvent),
      finalState: { tMs: 0 } as ScenarioState,
    };
  } catch {
    return undefined;
  }
}

export async function saveDebrief(d: StoredDebrief): Promise<void> {
  if (isDbConfigured && db) {
    try {
      await db.insert(schema.debriefs).values({
        id: d.id,
        sessionId: d.sessionId,
        rubric: d.rubric,
        compositeScore: d.compositeScore,
        narrative: d.narrative,
      });
    } catch (err) {
      console.warn("[debrief] DB write failed, falling back to memory:", err);
    }
  }
  memDebriefs.set(d.id, d);
}

export async function getDebrief(id: string): Promise<StoredDebrief | undefined> {
  const mem = memDebriefs.get(id);
  if (mem) return mem;
  if (!isDbConfigured || !db) return undefined;
  try {
    const row = await db
      .select()
      .from(schema.debriefs)
      .where(eq(schema.debriefs.id, id))
      .limit(1);
    if (!row[0]) return undefined;
    const r = row[0];
    return {
      id: r.id,
      sessionId: r.sessionId,
      rubric: r.rubric as DebriefRubric,
      compositeScore: r.compositeScore,
      narrative: r.narrative,
      createdAt: r.createdAt.getTime(),
    };
  } catch {
    return undefined;
  }
}

/**
 * List a user's recent debriefs. Returns empty when no DB OR no user — anonymous
 * demos can't have a "history" by design (sessions don't persist).
 */
export async function listUserDebriefs(
  userId: string,
  limit = 25,
): Promise<
  Array<{
    debriefId: string;
    sessionId: string;
    scenarioSlug: string;
    composite: number;
    createdAt: number;
  }>
> {
  if (!isDbConfigured || !db) return [];
  try {
    const userRow = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.clerkId, userId))
      .limit(1);
    if (!userRow[0]) return [];
    const rows = await db
      .select({
        debriefId: schema.debriefs.id,
        sessionId: schema.debriefs.sessionId,
        composite: schema.debriefs.compositeScore,
        createdAt: schema.debriefs.createdAt,
        scenarioSlug: schema.scenarios.slug,
      })
      .from(schema.debriefs)
      .innerJoin(
        schema.sessions,
        eq(schema.debriefs.sessionId, schema.sessions.id),
      )
      .innerJoin(
        schema.scenarios,
        eq(schema.sessions.scenarioId, schema.scenarios.id),
      )
      .where(eq(schema.sessions.userId, userRow[0].id))
      .orderBy(desc(schema.debriefs.createdAt))
      .limit(limit);
    return rows.map((r) => ({
      debriefId: r.debriefId,
      sessionId: r.sessionId,
      scenarioSlug: r.scenarioSlug,
      composite: r.composite,
      createdAt: r.createdAt.getTime(),
    }));
  } catch {
    return [];
  }
}
