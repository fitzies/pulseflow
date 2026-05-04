import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function isRetryablePrismaError(error: unknown): boolean {
  const retryableCodes = ["P1001", "P2024"]; // Connection failed + pool timeout
  const prismaError = error as { code?: string; errorCode?: string; name?: string; message?: string };
  const message = prismaError?.message ?? "";

  return (
    retryableCodes.includes(prismaError?.code ?? "") ||
    retryableCodes.includes(prismaError?.errorCode ?? "") ||
    prismaError?.name === "PrismaClientInitializationError" ||
    message.includes("Can't reach database server") ||
    message.includes("Timed out fetching a new connection") ||
    message.includes("Connection terminated") ||
    message.includes("closed the connection")
  );
}

/**
 * Retry wrapper for Prisma operations that may fail due to Neon cold starts or pool exhaustion.
 * Defaults to one retry only: initial attempt + one retry.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 2,
  baseDelayMs = 1000
): Promise<T> {
  const attempts = Math.min(Math.max(maxAttempts, 1), 2);

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      if (isRetryablePrismaError(error) && attempt < attempts) {
        const delay = baseDelayMs * attempt;
        console.warn(`[Prisma] Retryable database error, retrying once in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Retry attempts exhausted");
}

/**
 * Get or create a database user for the given Clerk user ID
 * This was moved out of middleware since Prisma can't run on Edge runtime
 */
export async function getOrCreateDbUser(clerkId: string, email?: string) {
  return prisma.user.upsert({
    where: { clerkId },
    update: email ? { email } : {},
    create: {
      clerkId,
      email: email ?? null,
      plan: null,
    },
  });
}
