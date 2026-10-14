import { describe, expect, it } from 'vitest';
import { RecordProcessRunPayloadSchema } from './process.js';

describe('RecordProcessRunPayloadSchema', () => {
    it('accepts schedule metadata for workflow-owned process runs', () => {
        expect(
            RecordProcessRunPayloadSchema.parse({
                workflow_id: 'ProcessRun:scheduled',
                first_workflow_run_id: 'temporal-run',
                run_kind: 'process',
                process_id: '68c01a23456789abcdef0123',
                schedule_id: 'schedule-1',
                type: 'schedule',
            }),
        ).toMatchObject({ schedule_id: 'schedule-1', type: 'schedule' });
    });
});
