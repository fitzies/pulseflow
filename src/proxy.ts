import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const isPublicRoute = createRouteMatcher([
  "/",
  "/auth(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
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
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
