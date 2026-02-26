import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/auth(.*)",
  "/guides(.*)",
  "/api/cron(.*)",
  "/api/stripe/webhooks",
  "/api/telegram/webhook",
  "/api/users",
]);

export default clerkMiddleware(async (auth, request) => {
  // Add pathname header for server components
  const pathname = new URL(request.url).pathname;
  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);

  // GET /api/automations/[id] is public (password-protected in route)
  const isGetAutomationDefinition =
    request.method === "GET" && /^\/api\/automations\/[^/]+$/.test(pathname);

  if (!isPublicRoute(request) && !isGetAutomationDefinition) {
    await auth.protect();
  }

  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and cron routes (auth via CRON_SECRET, no Clerk needed)
    "/((?!_next|api/cron|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // API/trpc routes except cron (auth via CRON_SECRET)
    "/(api|trpc)(?!/cron(?:/|$))(.*)",
  ],
};
