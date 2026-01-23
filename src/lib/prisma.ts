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

/**
 * Retry wrapper for Prisma operations that may fail due to Neon cold starts
 * Handles P1001 (connection failed) errors with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const prismaError = error as { code?: string };
      if (prismaError?.code === "P1001" && i < retries - 1) {
        const delay = baseDelay * (i + 1);
        console.warn(`[Prisma] Connection failed, retrying in ${delay}ms (${i + 1}/${retries})...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Retry attempts exhausted");
}
