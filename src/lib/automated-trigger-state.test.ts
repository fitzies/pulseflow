import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DISABLED_SCHEDULE_DATA,
  getAutomatedTriggerStateWhere,
  isAutomatedTriggerEnabled,
} from './automated-trigger-state';

test('disabled schedule data clears every field used by the scheduler', () => {
  assert.deepEqual(DISABLED_SCHEDULE_DATA, {
    triggerMode: 'MANUAL',
    cronExpression: null,
    nextRunAt: null,
  });
  assert.equal(
    isAutomatedTriggerEnabled(
      { triggerMode: DISABLED_SCHEDULE_DATA.triggerMode, cronExpression: null },
      'scheduled'
    ),
    false
  );
});

test('scheduled dispatch requires schedule mode and a cron expression', () => {
  assert.equal(
    isAutomatedTriggerEnabled(
      { triggerMode: 'SCHEDULE', cronExpression: '*/20 * * * *' },
      'scheduled'
    ),
    true
  );
  assert.equal(
    isAutomatedTriggerEnabled(
      { triggerMode: 'MANUAL', cronExpression: '*/20 * * * *' },
      'scheduled'
    ),
    false
  );
  assert.equal(
    isAutomatedTriggerEnabled(
      { triggerMode: 'SCHEDULE', cronExpression: null },
      'scheduled'
    ),
    false
  );
});

test('database filters use the same enabled state as the runtime check', () => {
  assert.deepEqual(getAutomatedTriggerStateWhere('scheduled'), {
    triggerMode: 'SCHEDULE',
    cronExpression: { not: null },
  });
  assert.deepEqual(getAutomatedTriggerStateWhere('price_trigger'), {
    triggerMode: 'PRICE_TRIGGER',
  });
});
