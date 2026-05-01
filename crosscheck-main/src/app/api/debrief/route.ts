import { z } from "zod";
import { randomUUID } from "node:crypto";
import { saveSession, saveDebrief } from "@/lib/sessions/store";
import { scoreSession } from "@/lib/scoring/llm";
import { getScenario } from "@/scenarios";
import { getUserId } from "@/lib/auth";

const eventSchema = z.looseObject({
  kind: z.string(),
  tMs: z.number(),
  source: z.enum(["pilot", "system"]),
});

const stateSchema = z.looseObject({
  tMs: z.number(),
});

const bodySchema = z.object({
  scenarioSlug: z.string(),
  startedAt: z.number(),
  endedAt: z.number(),
  events: z.array(eventSchema),
  finalState: stateSchema,
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const scenario = getScenario(parsed.data.scenarioSlug);
  if (!scenario) {
    return Response.json(
      { error: `Unknown scenario "${parsed.data.scenarioSlug}"` },
      { status: 400 },
    );
  }

  const userId = await getUserId();

  const sessionId = randomUUID();
  const debriefId = randomUUID();

  await saveSession({
    id: sessionId,
    scenarioSlug: parsed.data.scenarioSlug,
    startedAt: parsed.data.startedAt,
    endedAt: parsed.data.endedAt,
    events: parsed.data.events as never,
    finalState: parsed.data.finalState as never,
    userId,
  });

  const scored = await scoreSession({
    scenario,
    events: parsed.data.events as never,
    finalState: parsed.data.finalState as never,
  });

  await saveDebrief({
    id: debriefId,
    sessionId,
    rubric: scored.rubric,
    compositeScore: scored.compositeScore,
    narrative: scored.narrative,
    createdAt: Date.now(),
  });

  return Response.json({ ok: true, debriefId, sessionId });
}
