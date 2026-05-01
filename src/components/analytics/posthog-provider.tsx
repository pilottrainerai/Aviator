"use client";

import { useEffect, type ReactNode } from "react";

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
    if (!key) return;
    void (async () => {
      const ph = (await import("posthog-js")).default;
      ph.init(key, {
        api_host: host,
        capture_pageview: "history_change",
        person_profiles: "identified_only",
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).posthog = ph;
    })();
  }, []);
  return <>{children}</>;
}
