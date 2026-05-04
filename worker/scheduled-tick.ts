function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

const REQUEST_TIMEOUT_MS = 55_000;

async function main() {
  const appUrl = requiredEnv("APP_URL").replace(/\/+$/, "");
  const cronSecret = requiredEnv("CRON_SECRET");
  const schedulerPath = process.env.SCHEDULER_PATH?.trim() || "/api/cron/run-scheduled";
  const url = `${appUrl}${schedulerPath.startsWith("/") ? schedulerPath : `/${schedulerPath}`}`;

  console.log(`[Railway Cron] Calling ${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        authorization: `Bearer ${cronSecret}`,
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error(`[Railway Cron] Scheduler request timed out after ${REQUEST_TIMEOUT_MS}ms`);
      process.exitCode = 1;
      return;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const body = await response.text();
  console.log(`[Railway Cron] Scheduler responded ${response.status}: ${body}`);

  if (!response.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[Railway Cron] Failed:", error);
  process.exitCode = 1;
});
