import assert from 'node:assert/strict';
import test from 'node:test';
import {
  disableScheduleAndCancelExecutions,
  type ScheduleStopTransaction,
} from './stop-scheduled-automation';

test('stop disables automatic triggers before cancelling running executions', async () => {
  const calls: string[] = [];
  const stoppedAt = new Date('2026-08-29T12:00:00.000Z');
  const tx: ScheduleStopTransaction = {
    automation: {
      async updateMany(args) {
        calls.push('disable-schedule');
        assert.deepEqual(args, {
          where: {
            id: 'automation-1',
            userId: 'user-1',
            triggerMode: { in: ['SCHEDULE', 'PRICE_TRIGGER'] },
          },
          data: {
            triggerMode: 'MANUAL',
            cronExpression: null,
            nextRunAt: null,
          },
        });
        return { count: 1 };
      },
    },
    execution: {
      async updateMany(args) {
        calls.push('cancel-executions');
        assert.deepEqual(args, {
          where: {
            automationId: 'automation-1',
            status: 'RUNNING',
          },
          data: {
            status: 'CANCELLED',
            error: 'Cancelled by user',
            finishedAt: stoppedAt,
          },
        });
        return { count: 2 };
      },
    },
  };

  const result = await disableScheduleAndCancelExecutions(
    tx,
    'automation-1',
    'user-1',
    stoppedAt
  );

  assert.deepEqual(calls, ['disable-schedule', 'cancel-executions']);
  assert.deepEqual(result, {
    triggerDisabled: true,
    cancelledExecutionCount: 2,
  });
});

test('stop succeeds when no execution is running', async () => {
  const tx: ScheduleStopTransaction = {
    automation: {
      async updateMany() {
        return { count: 1 };
      },
    },
    execution: {
      async updateMany() {
        return { count: 0 };
      },
    },
  };

  const result = await disableScheduleAndCancelExecutions(
    tx,
    'automation-1',
    'user-1',
    new Date()
  );

  assert.deepEqual(result, {
    triggerDisabled: true,
    cancelledExecutionCount: 0,
  });
});
