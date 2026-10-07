import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, test } from 'vitest';
import { ExperimentalAdmitAgentGenerationPayloadSchema } from './agent-generation.js';
import {
    ExperimentalCanonicalInteractionStreamRequestSchema,
    ExperimentalCanonicalToolApprovalReviewStreamRequestSchema,
} from './canonical-interaction-stream.js';
import { ApiSchemaComponents } from './registry.js';

function reviewer() {
    return {
        kind: 'tool_approval_review',
        operation_id: 'review:one',
        parent: { execution_run_id: 'parent:one', generation_request_id: 'actual:child:one' },
        source: {
            conversation: { conversation_id: 'conversation:one', revision: 2 },
            turn_id: 'turn:one',
            block_id: 'block:one',
            call_id: 'call:one',
            call_fingerprint: `sha256:${'a'.repeat(64)}`,
        },
        control: { operation_id: 'routing:one', revision: 0 },
        request: {
            interaction: 'sys:ToolApprovalReviewer',
            data: { approval_request_json: '{"untrusted":"arbitrary prompt data"}', intent_json: '{}' },
        },
        agent_acceptance: {
            version: 1,
            subject_agent_run_id: 'subject:one',
            activity_id: 'activity:one',
            scope: 'root',
        },
        activity_delivery: { activity_id: 'activity:one', run_id: 'actual:run', task_token: 'opaque-token' },
        resume_after: { stream_id: 'stream:one', event_id: 'event:one', sequence: 1 },
    };
}
function validator(name: string) {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
    addFormats.default(ajv);
    return ajv.compile({ components: { schemas: ApiSchemaComponents }, $ref: `#/components/schemas/${name}` });
}
const schemas = [
    ExperimentalCanonicalToolApprovalReviewStreamRequestSchema,
    ExperimentalCanonicalInteractionStreamRequestSchema,
];
const validators = [
    'ExperimentalCanonicalToolApprovalReviewStreamRequest',
    'ExperimentalCanonicalInteractionStreamRequest',
].map(validator);
const mutations: Array<[string, (value: ReturnType<typeof reviewer>) => unknown]> = [
    ['ordinary kind', (value) => ({ ...value, kind: 'initial_agent' })],
    ['caller model', (value) => ({ ...value, model: 'invented' })],
    ['caller target', (value) => ({ ...value, target: {} })],
    ['caller admission', (value) => ({ ...value, generation_admission: {} })],
    ['caller head', (value) => ({ ...value, canonical_state: {} })],
    ['caller config', (value) => ({ ...value, request: { ...value.request, config: { environment: 'foreign' } } })],
    ['caller document', (value) => ({ ...value, request: { ...value.request, initial_state: { type: 'new' } } })],
    ['wrong interaction', (value) => ({ ...value, request: { ...value.request, interaction: 'tmp:untrusted' } })],
    [
        'extra prompt authority',
        (value) => ({ ...value, request: { ...value.request, data: { ...value.request.data, tool_name: 'other' } } }),
    ],
    [
        'oversized prompt',
        (value) => ({
            ...value,
            request: { ...value.request, data: { ...value.request.data, intent_json: 'x'.repeat(65537) } },
        }),
    ],
    ['empty parent', (value) => ({ ...value, parent: { ...value.parent, execution_run_id: '' } })],
    ['empty generation', (value) => ({ ...value, parent: { ...value.parent, generation_request_id: '' } })],
    [
        'incomplete source',
        (value) => ({ ...value, source: { conversation: value.source.conversation, call_id: value.source.call_id } }),
    ],
    ['caller source tool', (value) => ({ ...value, source: { ...value.source, tool_name: 'other' } })],
    ['invalid routing revision', (value) => ({ ...value, control: { ...value.control, revision: -1 } })],
    ['empty token', (value) => ({ ...value, activity_delivery: { ...value.activity_delivery, task_token: '' } })],
    [
        'caller namespace',
        (value) => ({ ...value, activity_delivery: { ...value.activity_delivery, namespace: 'foreign' } }),
    ],
    ['wrong cursor', (value) => ({ ...value, resume_after: { ...value.resume_after, sequence: -1 } })],
];

describe('strict dedicated reviewer wire contract', () => {
    test('preserves exact reviewer bytes, including untrusted prompt data and delivery-only cursor', () => {
        const bytes = JSON.parse(JSON.stringify(reviewer()));
        for (const schema of schemas) expect(schema.parse(bytes)).toEqual(bytes);
        for (const validate of validators) expect(validate(bytes)).toBe(true);
        const admission = { operation: 'tool_approval_review', request: bytes };
        expect(ExperimentalAdmitAgentGenerationPayloadSchema.parse(admission)).toEqual(admission);
        expect(validator('ExperimentalAdmitAgentGenerationPayload')(admission)).toBe(true);
        expect(validator('ExperimentalAdmitAgentGenerationToolApprovalReviewPayload')(admission)).toBe(true);
    });
    test.each(mutations)('%s fails in Zod and published JSON Schema', (_name, mutate) => {
        const bytes = JSON.parse(JSON.stringify(mutate(reviewer())));
        for (const schema of schemas) expect(schema.safeParse(bytes).success).toBe(false);
        for (const validate of validators) expect(validate(bytes)).toBe(false);
        const admission = { operation: 'tool_approval_review', request: bytes };
        expect(ExperimentalAdmitAgentGenerationPayloadSchema.safeParse(admission).success).toBe(false);
        expect(validator('ExperimentalAdmitAgentGenerationPayload')(admission)).toBe(false);
    });
    test('requires the real reviewer operation instead of admitting a review as user or initial work', () => {
        for (const operation of ['user', 'tools', 'checkpoint_summary', 'initial']) {
            const value = { operation, request: reviewer() };
            expect(ExperimentalAdmitAgentGenerationPayloadSchema.safeParse(value).success).toBe(false);
            expect(validator('ExperimentalAdmitAgentGenerationPayload')(value)).toBe(false);
        }
    });
});
