import { getQuiz } from "@/quizzes";

/**
 * Read-only proxy to the Google Apps Script GET endpoint.
 *
 * Apps Script GET also returns 302 → script.googleusercontent.com/macros/echo
 * with the JSON body. Unlike POST, the redirect can be safely followed (GET
 * stays GET), but we follow manually to control timing and avoid any
 * cross-origin oddities in serverless runtimes.
 */

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const quiz = getQuiz(slug);
  if (!quiz) {
    return Response.json({ error: "Unknown quiz" }, { status: 404 });
  }

  const webhookUrl = process.env.QUIZ_WEBHOOK_URL;
  if (!webhookUrl) {
    return Response.json({
      ok: true,
      configured: false,
      rows: [],
      message:
        "QUIZ_WEBHOOK_URL is not set. Configure it to fetch responses from your Google Sheet.",
    });
  }

  try {
    const url = `${webhookUrl}?slug=${encodeURIComponent(slug)}`;
    const first = await fetch(url, {
      cache: "no-store",
      redirect: "manual",
    });

    let final: Response = first;
    if (first.status === 302) {
      const location = first.headers.get("location");
      if (!location) {
        return Response.json(
          { error: "Webhook returned 302 without Location" },
          { status: 502 },
        );
      }
      final = await fetch(location, { cache: "no-store" });
    }

    if (!final.ok) {
      return Response.json(
        { error: "Webhook returned " + final.status },
        { status: 502 },
      );
    }
    const data = (await final.json()) as { ok?: boolean; rows?: unknown[] };
    return Response.json({ ok: true, configured: true, rows: data.rows ?? [] });
  } catch (err) {
    console.error("[quiz/responses] fetch failed", err);
    return Response.json(
      { error: "Could not fetch from webhook" },
      { status: 502 },
    );
  }
}
