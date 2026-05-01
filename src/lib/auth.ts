/**
 * Auth helpers. Clerk is optional — the app runs without keys (anonymous mode).
 * Production wiring activates the moment NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set.
 */

export const isClerkConfigured = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/**
 * Server-side user ID. Returns null when:
 *   - Clerk isn't configured, or
 *   - the request isn't authenticated.
 */
export async function getUserId(): Promise<string | null> {
  if (!isClerkConfigured()) return null;
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const session = await auth();
    return session.userId ?? null;
  } catch {
    return null;
  }
}
