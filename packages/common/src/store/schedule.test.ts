import { describe, expectTypeOf, it } from 'vitest';
import type { AgentSchedule, CreateSchedulePayload, ScheduleListItem, UpdateSchedulePayload } from './schedule.js';

describe('CreateSchedulePayload', () => {
    it('accepts agent schedules without an explicit target', () => {
        expectTypeOf({
            run_as: { mode: 'creator' as const },
            name: 'Weekly report',
            interaction: 'WeeklyReportAgent',
            cron_expression: '0 9 * * MON',
        }).toMatchTypeOf<CreateSchedulePayload>();
    });

    it('accepts process schedules with context', () => {
        expectTypeOf({
            run_as: { mode: 'creator' as const },
            name: 'Nightly refresh',
            target: 'process' as const,
            process: '68c01a23456789abcdef0123',
            cron_expression: '0 2 * * *',
            context: { collection: 'reports' },
        }).toMatchTypeOf<CreateSchedulePayload>();
    });

    it('rejects a process schedule without a process definition', () => {
        expectTypeOf({
            run_as: { mode: 'creator' as const },
            name: 'Nightly refresh',
            target: 'process' as const,
            cron_expression: '0 2 * * *',
        }).not.toMatchTypeOf<CreateSchedulePayload>();
    });
});

describe('schedule read models', () => {
    it('report the configuration a process schedule fires with', () => {
        // The gap this closes: execution worked, but nothing read back said what a process schedule
        // ran with, so it could not be inspected or recreated from the API.
        expectTypeOf<AgentSchedule['context']>().toEqualTypeOf<Record<string, unknown> | undefined>();
        expectTypeOf<AgentSchedule['run_type']>().toEqualTypeOf<'programmatic' | 'supervised' | undefined>();
    });

    it('summarize run_type in a listing but not context', () => {
        // `run_type` is a scalar, like `target`. `context` is caller-sized payload, so it stays out
        // of the summary for the same reason `vars` does.
        expectTypeOf<ScheduleListItem['run_type']>().toEqualTypeOf<'programmatic' | 'supervised' | undefined>();
        expectTypeOf<ScheduleListItem>().not.toHaveProperty('context');
        expectTypeOf<ScheduleListItem>().not.toHaveProperty('vars');
    });

    it('do not accept execution inputs on update', () => {
        // These are fixed in the scheduler at creation and update does not re-publish the job
        // specification, so accepting them would record a change that never takes effect.
        expectTypeOf<UpdateSchedulePayload>().not.toHaveProperty('context');
        expectTypeOf<UpdateSchedulePayload>().not.toHaveProperty('run_type');
        expectTypeOf<UpdateSchedulePayload>().not.toHaveProperty('process');
        expectTypeOf<UpdateSchedulePayload>().not.toHaveProperty('interaction');
    });
});
