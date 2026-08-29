import type { TriggerMode } from '@prisma/client';

export type AutomatedTriggerType = 'scheduled' | 'price_trigger';

type AutomatedTriggerState = {
  triggerMode: TriggerMode;
  cronExpression?: string | null;
};

export const DISABLED_SCHEDULE_DATA = {
  triggerMode: 'MANUAL' as const,
  cronExpression: null,
  nextRunAt: null,
};

export function getAutomatedTriggerStateWhere(type: AutomatedTriggerType) {
  if (type === 'scheduled') {
    return {
      triggerMode: 'SCHEDULE' as const,
      cronExpression: { not: null },
    };
  }

  return {
    triggerMode: 'PRICE_TRIGGER' as const,
  };
}

export function isAutomatedTriggerEnabled(
  automation: AutomatedTriggerState,
  type: AutomatedTriggerType
): boolean {
  if (type === 'scheduled') {
    return (
      automation.triggerMode === 'SCHEDULE' &&
      typeof automation.cronExpression === 'string' &&
      automation.cronExpression.length > 0
    );
  }

  return automation.triggerMode === 'PRICE_TRIGGER';
}
