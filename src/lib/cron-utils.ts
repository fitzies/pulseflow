const MIN_INTERVAL_MINUTES = 20;

// Preset schedule options for the UI
// All schedules align with 20-minute intervals (mod 20 = 0)
export const SCHEDULE_PRESETS = [
  { label: '20', value: '*/20 * * * *' },
  { label: '40', value: '*/40 * * * *' },
  { label: 'hr', value: '0 * * * *' },
  { label: '2hr', value: '0 */2 * * *' },
  { label: '6hr', value: '0 */6 * * *' },
  { label: 'Every day at midnight', value: '0 0 * * *' },
] as const;

/**
 * Basic client-side cron expression validation (format check only)
 */
export function validateCronExpressionFormat(expression: string): { valid: boolean; error?: string } {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return { valid: false, error: 'Cron expression must have exactly 5 fields (minute hour day month weekday)' };
  }

  // Basic pattern check for each field
  const patterns = [
    /^(\*|(\*\/)?[0-9]+(-[0-9]+)?(,[0-9]+(-[0-9]+)?)*)$/, // minute (0-59)
    /^(\*|(\*\/)?[0-9]+(-[0-9]+)?(,[0-9]+(-[0-9]+)?)*)$/, // hour (0-23)
    /^(\*|(\*\/)?[0-9]+(-[0-9]+)?(,[0-9]+(-[0-9]+)?)*)$/, // day of month (1-31)
    /^(\*|(\*\/)?[0-9]+(-[0-9]+)?(,[0-9]+(-[0-9]+)?)*)$/, // month (1-12)
    /^(\*|(\*\/)?[0-9]+(-[0-9]+)?(,[0-9]+(-[0-9]+)?)*)$/, // day of week (0-7)
  ];

  for (let i = 0; i < 5; i++) {
    if (!patterns[i].test(parts[i])) {
      return { valid: false, error: `Invalid cron field: ${parts[i]}` };
    }
  }

  return { valid: true };
}

/**
 * Client-side check for minimum interval (basic heuristic)
 */
export function validateMinimumIntervalClient(cronExpression: string): { valid: boolean; error?: string } {
  const formatCheck = validateCronExpressionFormat(cronExpression);
  if (!formatCheck.valid) return formatCheck;

  const parts = cronExpression.trim().split(/\s+/);
  const [minute] = parts;

  // Check for intervals less than 20 minutes
  if (minute.startsWith('*/')) {
    const interval = parseInt(minute.slice(2), 10);
    if (!isNaN(interval) && interval < MIN_INTERVAL_MINUTES) {
      return {
        valid: false,
        error: `Minimum interval is ${MIN_INTERVAL_MINUTES} minutes. Your schedule runs every ${interval} minutes.`,
      };
    }
  }

  // Check for multiple specific minutes that would run too frequently
  if (minute.includes(',')) {
    const minutes = minute.split(',').map(m => parseInt(m, 10)).filter(m => !isNaN(m));
    if (minutes.length > 3) {
      return {
        valid: false,
        error: `Schedule appears to run too frequently. Minimum interval is ${MIN_INTERVAL_MINUTES} minutes.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Formats a cron expression into a human-readable string
 */
export function formatCronExpression(cronExpression: string): string {
  // Check if it matches a preset
  const preset = SCHEDULE_PRESETS.find((p) => p.value === cronExpression);
  if (preset) {
    return preset.label;
  }

  // Try to generate a simple description
  try {
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) return cronExpression;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    // Every X minutes
    if (minute.startsWith('*/') && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      const mins = minute.slice(2);
      return `Every ${mins} minutes`;
    }

    // Every hour at minute X
    if (!minute.includes('*') && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return `Every hour at minute ${minute}`;
    }

    // Specific time daily
    if (!minute.includes('*') && !hour.includes('*') && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return `Daily at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    }

    return cronExpression;
  } catch {
    return cronExpression;
  }
}
