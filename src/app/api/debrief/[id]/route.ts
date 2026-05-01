import { getDebrief, getSession } from "@/lib/sessions/store";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const debrief = await getDebrief(id);
  if (!debrief) {
    return Response.json({ error: "Debrief not found" }, { status: 404 });
  }
  const session = await getSession(debrief.sessionId);
  return Response.json({
    ok: true,
    debrief,
    session,
  });
}
