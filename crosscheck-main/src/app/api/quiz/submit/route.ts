import { z } from "zod";
import { getQuiz } from "@/quizzes";

/**
 * Forwards a quiz submission to a Google Apps Script web-app endpoint.
 * Configure via QUIZ_WEBHOOK_URL.
 *
 * Apps Script quirk: a successful doPost returns HTTP 302 to a cached output
 * URL on script.googleusercontent.com. Following the redirect converts POST
 * to GET on a route that doesn't accept GET, yielding 405 even though the
 * row was already written. We treat the outbound POST as fire-and-forget:
 * if Apps Script accepted the request (any non-5xx response, or any
 * networking that didn't throw), the row is in the sheet. The admin GET
 * endpoint is the source of truth for whether persistence worked.
 *
 * Falls back to console.log + 200 OK when the webhook isn't configured.
 */

const bodySchema = z.object({
  quizSlug: z.string().min(1),
  respondent: z.string().max(200).optional(),
  answers: z.record(z.string(), z.string()),
  submittedAt: z.string(),
  userAgent: z.string().max(500).optional(),
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

  const quiz = getQuiz(parsed.data.quizSlug);
  if (!quiz) {
    return Response.json(
      { error: `Unknown quiz "${parsed.data.quizSlug}"` },
      { status: 400 },
    );
  }

  const webhookUrl = process.env.QUIZ_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn(
      "[quiz/submit] QUIZ_WEBHOOK_URL not set — accepting without persisting.",
      JSON.stringify(parsed.data, null, 2),
    );
    return Response.json({ ok: true, persisted: false });
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
      redirect: "manual",
    });

    console.info(
      "[quiz/submit] webhook status",
      res.status,
      res.type,
      res.headers.get("location") ? "redirect" : "no-redirect",
    );

    // Accept anything that isn't a server error. Apps Script returns 302
    // (true success), and Node's undici sometimes reports redirect responses
    // as type "opaqueredirect" with status 0 — both are fine; the row is
    // already written by the time the response is dispatched.
    if (res.status >= 500) {
      return Response.json(
        { error: `Webhook returned ${res.status}` },
        { status: 502 },
      );
    }
    return Response.json({ ok: true, persisted: true, upstreamStatus: res.status });
  } catch (err) {
    console.error("[quiz/submit] webhook network error", err);
    return Response.json(
      { error: "Could not reach webhook" },
      { status: 502 },
    );
  }
}
