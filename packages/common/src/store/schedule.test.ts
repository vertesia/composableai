import { describe, expectTypeOf, it } from 'vitest';
import type { CreateSchedulePayload } from './schedule.js';

describe('CreateSchedulePayload', () => {
    it('accepts agent schedules without an explicit target', () => {
        expectTypeOf({
            name: 'Weekly report',
            interaction: 'WeeklyReportAgent',
            cron_expression: '0 9 * * MON',
        }).toMatchTypeOf<CreateSchedulePayload>();
    });

    it('accepts process schedules with context', () => {
        expectTypeOf({
            name: 'Nightly refresh',
            target: 'process' as const,
            process: '68c01a23456789abcdef0123',
            cron_expression: '0 2 * * *',
            context: { collection: 'reports' },
        }).toMatchTypeOf<CreateSchedulePayload>();
    });

    it('rejects a process schedule without a process definition', () => {
        expectTypeOf({
            name: 'Nightly refresh',
            target: 'process' as const,
            cron_expression: '0 2 * * *',
        }).not.toMatchTypeOf<CreateSchedulePayload>();
    });
});
