import { NextResponse, type NextRequest } from "next/server";

const passthrough = (_req: NextRequest) => NextResponse.next();

const middleware = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ? // Lazy require so we don't pull Clerk into edge bundle when keys aren't set
    (() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { clerkMiddleware } = require("@clerk/nextjs/server") as {
        clerkMiddleware: () => (req: NextRequest) => Promise<Response> | Response;
      };
      return clerkMiddleware();
    })()
  : passthrough;

export default middleware;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/|api/waitlist).*)",
  ],
};
