import { describe, expect, it } from 'vitest';
import { validateApiRequest } from '../api-contract/index.js';
import {
    ExperimentalCanonicalCheckpointSummaryPayloadSchema,
    ExperimentalCanonicalUserMessageRequestSchema,
} from './canonical-conversation-resume.js';

const summary = {
    kind: 'checkpoint_summary',
    run: { id: 'interaction:1', account: 'account:1', project: 'project:1' },
    operation_id: 'summary:1',
    source: {
        subject_agent_run_id: 'agent:1',
        conversation: { conversation_id: 'conversation:1', revision: 0 },
        scope: 'root',
    },
    control: { operation_id: 'routing:1', revision: 0 },
    asyncCompletion: {
        run_id: 'actual:delivery',
        activity_id: 'actual:activity',
        task_token: 'opaque:token',
        heartbeat_interval_ms: 10000,
    },
};
describe('canonical checkpoint summary request contract', () => {
    it('validates the exact token-bearing derived branch with both runtime validators', () => {
        expect(ExperimentalCanonicalCheckpointSummaryPayloadSchema.parse(summary)).toEqual(summary);
        expect(ExperimentalCanonicalUserMessageRequestSchema.parse(summary)).toEqual(summary);
        expect(validateApiRequest('ExperimentalCanonicalUserMessageRequest', summary)).toMatchObject({
            valid: true,
            data: summary,
        });
    });
    it.each(['config', 'model', 'conversation', 'fork', 'agent_acceptance', 'input_append', 'output', 'current_state'])(
        'rejects caller %s authority rather than selecting an ambiguous branch',
        (key) => {
            const input = { ...summary, [key]: {} };
            expect(ExperimentalCanonicalUserMessageRequestSchema.safeParse(input).success).toBe(false);
            expect(validateApiRequest('ExperimentalCanonicalUserMessageRequest', input)).toMatchObject({
                valid: false,
            });
        },
    );
    it('requires the explicit kind, exact source revision and genuine callback selector', () => {
        const { kind: _kind, ...withoutKind } = summary;
        for (const input of [
            withoutKind,
            { ...summary, kind: 'user' },
            { ...summary, source: { ...summary.source, conversation: { conversation_id: 'conversation:1' } } },
            { ...summary, asyncCompletion: { ...summary.asyncCompletion, task_token: '' } },
            { ...summary, asyncCompletion: { ...summary.asyncCompletion, agent_acceptance: {} } },
        ]) {
            expect(ExperimentalCanonicalUserMessageRequestSchema.safeParse(input).success).toBe(false);
            expect(validateApiRequest('ExperimentalCanonicalUserMessageRequest', input)).toMatchObject({
                valid: false,
            });
        }
    });
});
