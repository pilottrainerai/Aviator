import { z } from "zod";
import { getDebrief, getSession } from "@/lib/sessions/store";
import { getScenario } from "@/scenarios";
import { getLLM, isLLMConfigured } from "@/lib/llm";

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
});

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid message" }, { status: 400 });
  }

  const debrief = await getDebrief(id);
  if (!debrief) {
    return Response.json({ error: "Debrief not found" }, { status: 404 });
  }

  if (!isLLMConfigured()) {
    return Response.json({
      ok: true,
      reply:
        "Chat follow-ups will be live once GROQ_API_KEY is configured. The debrief above was computed deterministically from your action log.",
    });
  }

  const session = await getSession(debrief.sessionId);
  const scenario = session ? getScenario(session.scenarioSlug) : undefined;

  try {
    const llm = getLLM();
    const out = await llm.complete({
      messages: [
        {
          role: "system",
          content: `You are a type-rated A320 examiner who just debriefed a pilot on the scenario "${
            scenario?.meta.title ?? "an abnormal procedure"
          }". Be direct, specific, and brief — 2 to 4 sentences. No hedging.`,
        },
        {
          role: "assistant",
          content: debrief.narrative,
        },
        { role: "user", content: parsed.data.message },
      ],
      temperature: 0.4,
    });
    return Response.json({ ok: true, reply: out.text });
  } catch (err) {
    console.warn("[debrief/chat] LLM failed:", err);
    return Response.json({
      ok: true,
      reply: "I lost the connection. Try again in a moment.",
    });
  }
}
