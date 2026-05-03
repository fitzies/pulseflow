function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

async function main() {
  const appUrl = requiredEnv("APP_URL").replace(/\/+$/, "");
  const cronSecret = requiredEnv("CRON_SECRET");
  const schedulerPath = process.env.SCHEDULER_PATH?.trim() || "/api/cron/run-scheduled";
  const url = `${appUrl}${schedulerPath.startsWith("/") ? schedulerPath : `/${schedulerPath}`}`;

  console.log(`[Railway Cron] Calling ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${cronSecret}`,
    },
  });

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
