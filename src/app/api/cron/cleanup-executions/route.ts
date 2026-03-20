import { prisma, withRetry } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_RETENTION_DAYS = 7;

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
    const result = await withRetry(() =>
      prisma.execution.deleteMany({
        where: { startedAt: { lt: cutoff } },
      })
    );

    console.log(
      `[Cron] cleanup-executions: deleted ${result.count} rows older than ${retentionDays}d (before ${cutoff.toISOString()})`
    );

    return new Response(
      JSON.stringify({
        deleted: result.count,
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
