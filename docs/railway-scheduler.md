# Railway Scheduler

PulseFlow uses two Railway services from this GitHub repo:

1. `pulseflow` persistent worker
   - Config file: `railway.toml`
   - Start command: `pnpm run railway:worker`
   - Public endpoint: `/health`
   - Purpose: receives `/run-automation` requests from the Vercel scheduler and executes automations.

2. `pulseflow-scheduler` cron service
   - Config file: `railway.scheduler.toml`
   - Start command: `pnpm run railway:scheduler`
   - Cron schedule: `*/20 * * * *`
   - Purpose: calls `APP_URL/api/cron/run-scheduled` with the shared `CRON_SECRET`, then exits.

Required Railway variables:

- `APP_URL`: public Vercel app URL, for example `https://pulseflow.vercel.app`
- `CRON_SECRET`: same value as Vercel
- `DATABASE_URL`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `WALLET_ENCRYPTION_PASSWORD`
- Any integration secrets used by automation execution, such as Telegram variables.

Required Vercel variables:

- `CRON_SECRET`: same value as Railway
- `WORKER_URL`: public Railway worker URL, for example `https://pulseflow-production-xxxx.up.railway.app`

Notes:

- The scheduler service must be a Railway cron service, not a persistent web service.
- The worker service must remain persistent because it listens for `/run-automation`.
- Keep the scheduler and worker as separate Railway services even though they deploy from the same repository.
- When creating `pulseflow-scheduler` from GitHub, set its Railway config source to `railway.scheduler.toml` so it does not inherit the worker config in `railway.toml`.
