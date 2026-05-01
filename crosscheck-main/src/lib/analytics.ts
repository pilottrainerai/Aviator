/**
 * PostHog wrapper. No-ops when NEXT_PUBLIC_POSTHOG_KEY isn't set.
 * Use these helpers everywhere — never import posthog-js directly.
 */

export const isAnalyticsConfigured = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);

type EventName =
  | "scenario_started"
  | "scenario_completed"
  | "step_performed"
  | "decision_committed"
  | "debrief_opened"
  | "debrief_chat_sent"
  | "waitlist_submitted"
  | "sign_in_started";

export function track(
  event: EventName,
  properties: Record<string, string | number | boolean | null> = {},
): void {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ph = (window as any).posthog as
    | { capture: (e: string, p?: object) => void }
    | undefined;
  if (!ph) return;
  ph.capture(event, properties);
}
