import { describe, expect, it } from 'vitest';
import { validateApiRequest, validateApiResponse } from './registry.js';

describe('agent history delta wire contract', () => {
    it('accepts optional cursors and bounds their size', () => {
        expect(validateApiRequest('AgentRunDetailsQuery', { include_history: true, from: 'opaque' }).valid).toBe(true);
        expect(validateApiRequest('AgentRunDetailsQuery', { from: {} }).valid).toBe(false);
        expect(validateApiRequest('AgentRunDetailsQuery', { from: 'x'.repeat(12001) }).valid).toBe(false);
    });
    it('validates legacy, snapshot, and delta responses through the registered contract', () => {
        for (const mode of [undefined, 'snapshot', 'delta']) {
            expect(
                validateApiResponse('WorkflowRunWithDetails', {
                    started_at: null,
                    closed_at: null,
                    history: {
                        type: 'agent',
                        ...(mode ? { mode, next_from: 'opaque' } : {}),
                        agentTasks: [
                            {
                                history_id: 'run:activity:7',
                                taskType: 'tool_call',
                                toolName: 'test',
                                status: 'running',
                                scheduled_at: null,
                                started_at: null,
                                completed_at: null,
                            },
                        ],
                    },
                }).valid,
            ).toBe(true);
        }
        expect(
            validateApiResponse('WorkflowRunWithDetails', {
                started_at: null,
                closed_at: null,
                history: { type: 'agent', mode: 'append', agentTasks: [] },
            }).valid,
        ).toBe(false);
    });
});
