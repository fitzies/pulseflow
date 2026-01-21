import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const isPublicRoute = createRouteMatcher([
  "/",
  "/auth(.*)",
  "/api/cron(.*)",
  "/api/automations/(.*)/run-cron",
  "/api/stripe/webhooks",
  "/api/telegram/webhook",
]);

const clerkProxy = clerkMiddleware(async (auth, request) => {
  // Add pathname header for server components
  const pathname = new URL(request.url).pathname;
  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);

  if (!isPublicRoute(request)) {
    const { userId } = await auth.protect();

    // Sync Clerk user with database
    if (userId) {
      const existingUser = await prisma.user.findUnique({
        where: { clerkId: userId },
      });

      if (!existingUser) {
        await prisma.user.create({
          data: {
            clerkId: userId,
            plan: null,
          },
        });
      }
    }
  }

  return response;
});

export async function proxy(request: NextRequest) {
  return clerkProxy(request, {} as any);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
