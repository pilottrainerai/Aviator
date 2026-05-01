import { z } from "zod";
import { db, schema, isDbConfigured } from "@/lib/db";

const bodySchema = z.object({
  email: z.email(),
  source: z.string().max(64).optional(),
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
    return Response.json({ error: "Invalid email" }, { status: 400 });
  }

  if (!isDbConfigured || !db) {
    console.warn(
      "[waitlist] DATABASE_URL not set — accepting submission without persisting:",
      parsed.data.email,
    );
    return Response.json({ ok: true, persisted: false });
  }

  try {
    await db
      .insert(schema.waitlist)
      .values({
        email: parsed.data.email,
        source: parsed.data.source,
      })
      .onConflictDoNothing({ target: schema.waitlist.email });
  } catch (err) {
    console.error("[waitlist] insert failed", err);
    return Response.json({ error: "Could not save" }, { status: 500 });
  }

  return Response.json({ ok: true, persisted: true });
}
