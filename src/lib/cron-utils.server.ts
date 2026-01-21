import 'server-only';
import { CronExpressionParser } from 'cron-parser';

const MIN_INTERVAL_MINUTES = 20;

/**
 * Validates a cron expression (server-side only)
 */
export async function validateCronExpression(expression: string): Promise<{ valid: boolean; error?: string }> {
  try {
    CronExpressionParser.parse(expression);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid cron expression',
    };
  }
}

/**
 * Calculates the next run date from a cron expression (server-side only)
 */
export async function getNextRunDate(cronExpression: string, fromDate?: Date): Promise<Date | null> {
  try {
    const interval = CronExpressionParser.parse(cronExpression, {
      currentDate: fromDate || new Date(),
    });
    return interval.next().toDate();
  } catch {
    return null;
  }
}

/**
 * Gets the minimum interval in minutes between runs for a cron expression (server-side only)
 */
export async function getMinimumInterval(cronExpression: string): Promise<number> {
  try {
    const now = new Date();
    const interval = CronExpressionParser.parse(cronExpression, { currentDate: now });

    // Get the next 5 occurrences and find the minimum gap
    const occurrences: Date[] = [];
    for (let i = 0; i < 5; i++) {
      occurrences.push(interval.next().toDate());
    }

    let minGap = Infinity;
    for (let i = 1; i < occurrences.length; i++) {
      const gap = (occurrences[i].getTime() - occurrences[i - 1].getTime()) / (1000 * 60);
      minGap = Math.min(minGap, gap);
    }

    return minGap === Infinity ? -1 : Math.round(minGap);
  } catch {
    return -1;
  }
}

/**
 * Validates that a cron expression has at least the minimum interval (server-side only)
 */
export async function validateMinimumInterval(cronExpression: string): Promise<{ valid: boolean; error?: string; interval?: number }> {
  const validation = await validateCronExpression(cronExpression);
  if (!validation.valid) {
    return validation;
  }

  const interval = await getMinimumInterval(cronExpression);
  if (interval === -1) {
    return { valid: false, error: 'Unable to calculate interval' };
  }

  if (interval < MIN_INTERVAL_MINUTES) {
    return {
      valid: false,
      error: `Minimum interval is ${MIN_INTERVAL_MINUTES} minutes. Your schedule runs every ${interval} minutes.`,
      interval,
    };
  }

  return { valid: true, interval };
}
