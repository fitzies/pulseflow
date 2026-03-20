import { prisma, withRetry } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Vercel Pro allows up to 300s; large deletes use batched work below. */
export const maxDuration = 300;

const DEFAULT_RETENTION_DAYS = 7;
const DELETE_BATCH_SIZE = 2000;

/** When `EXECUTION_RETENTION_DAYS` is unset, empty, or invalid, use 7. */
function getRetentionDays(): number {
  const raw = process.env.EXECUTION_RETENTION_DAYS?.trim();
  if (raw === undefined || raw === "") return DEFAULT_RETENTION_DAYS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_RETENTION_DAYS;
  return n;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const retentionDays = getRetentionDays();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  try {
    let deleted = 0;
    let batches = 0;

    for (;;) {
      const rows = await withRetry(() =>
        prisma.execution.findMany({
          where: { startedAt: { lt: cutoff } },
          select: { id: true },
          take: DELETE_BATCH_SIZE,
        })
      );
      if (rows.length === 0) break;

      const result = await withRetry(() =>
        prisma.execution.deleteMany({
          where: { id: { in: rows.map((r) => r.id) } },
        })
      );
      deleted += result.count;
      batches += 1;
    }

    console.log(
      `[Cron] cleanup-executions: deleted ${deleted} rows in ${batches} batch(es); older than ${retentionDays}d (before ${cutoff.toISOString()})`
    );

    return new Response(
      JSON.stringify({
        deleted,
        batches,
        retentionDays,
        cutoff: cutoff.toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("[Cron] cleanup-executions failed:", e);
    return new Response(JSON.stringify({ error: "Cleanup failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
