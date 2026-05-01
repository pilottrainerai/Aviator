"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const ClerkProviderDynamic = dynamic(
  () => import("@clerk/nextjs").then((m) => ({ default: m.ClerkProvider })),
  { ssr: true },
);

const PostHogProvider = dynamic(
  () => import("./analytics/posthog-provider").then((m) => m.PostHogProvider),
  { ssr: false },
);

export function Providers({ children }: { children: ReactNode }) {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  let tree = <>{children}</>;

  if (posthogKey) {
    tree = <PostHogProvider>{tree}</PostHogProvider>;
  }

  if (clerkKey) {
    tree = (
      <ClerkProviderDynamic
        publishableKey={clerkKey}
        appearance={{
          variables: {
            colorPrimary: "#FFB000",
            colorBackground: "#0A0B0D",
            colorInputBackground: "#14161A",
            colorText: "#E6E8EC",
            colorTextSecondary: "#8A92A0",
            borderRadius: "2px",
          },
        }}
      >
        {tree}
      </ClerkProviderDynamic>
    );
  }

  return tree;
}
