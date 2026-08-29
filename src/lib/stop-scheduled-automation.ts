import { DISABLED_SCHEDULE_DATA } from './automated-trigger-state';

type UpdateResult = { count: number };

export type ScheduleStopTransaction = {
  automation: {
    updateMany(args: {
      where: {
        id: string;
        userId: string;
        triggerMode: { in: ['SCHEDULE', 'PRICE_TRIGGER'] };
      };
      data: typeof DISABLED_SCHEDULE_DATA;
    }): Promise<UpdateResult>;
  };
  execution: {
    updateMany(args: {
      where: { automationId: string; status: 'RUNNING' };
      data: {
        status: 'CANCELLED';
        error: string;
        finishedAt: Date;
      };
    }): Promise<UpdateResult>;
  };
};

export async function disableScheduleAndCancelExecutions(
  tx: ScheduleStopTransaction,
  automationId: string,
  userId: string,
  stoppedAt: Date
) {
  const disabledSchedule = await tx.automation.updateMany({
    where: {
      id: automationId,
      userId,
      triggerMode: { in: ['SCHEDULE', 'PRICE_TRIGGER'] },
    },
    data: DISABLED_SCHEDULE_DATA,
  });

  const cancelledExecutions = await tx.execution.updateMany({
    where: {
      automationId,
      status: 'RUNNING',
    },
    data: {
      status: 'CANCELLED',
      error: 'Cancelled by user',
      finishedAt: stoppedAt,
    },
  });

  return {
    triggerDisabled: disabledSchedule.count === 1,
    cancelledExecutionCount: cancelledExecutions.count,
  };
}
