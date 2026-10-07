import { createConversationDocument } from '@llumiverse/conversation';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, test } from 'vitest';
import { ExperimentalAdmitAgentGenerationPayloadSchema } from './agent-generation.js';
import {
    ExperimentalCanonicalInitialAgentStreamRequestSchema,
    ExperimentalCanonicalInteractionStreamRequestSchema,
} from './canonical-interaction-stream.js';
import { ApiSchemaComponents } from './registry.js';

const document = createConversationDocument({ id: 'conversation:initial', created_at: '2026-10-03T00:00:00Z' });
function initial() {
    return {
        kind: 'initial_agent',
        operation_id: 'initial:activity:one',
        request: {
            interaction: 'agent:test',
            initial_state: { type: 'document', document },
            retention: 'DEBUG',
            return_policy: { history: 'none' },
        },
        agent_acceptance: {
            version: 1,
            subject_agent_run_id: 'subject:one',
            activity_id: 'activity:one',
            scope: 'root',
        },
        activity_delivery: { activity_id: 'activity:one', run_id: 'actual:run', task_token: 'opaque-token' },
    };
}
function validator(name: string) {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
    addFormats.default(ajv);
    return ajv.compile({ components: { schemas: ApiSchemaComponents }, $ref: `#/components/schemas/${name}` });
}
const mutations: Array<[string, (value: ReturnType<typeof initial>) => unknown]> = [
    [
        'missing purpose',
        (value) => {
            const { kind: _kind, ...rest } = value;
            return rest;
        },
    ],
    ['unknown purpose', (value) => ({ ...value, kind: 'user' })],
    [
        'ordinary initial-state new',
        (value) => ({ ...value, request: { ...value.request, initial_state: { type: 'new' } } }),
    ],
    ['non-debug retention', (value) => ({ ...value, request: { ...value.request, retention: 'INFO' } })],
    [
        'returned history document',
        (value) => ({ ...value, request: { ...value.request, return_policy: { history: 'document' } } }),
    ],
    ['empty token', (value) => ({ ...value, activity_delivery: { ...value.activity_delivery, task_token: '' } })],
    ['empty actual run', (value) => ({ ...value, activity_delivery: { ...value.activity_delivery, run_id: '' } })],
    [
        'empty actual activity',
        (value) => ({ ...value, activity_delivery: { ...value.activity_delivery, activity_id: '' } }),
    ],
    ['caller run', (value) => ({ ...value, run: { id: 'invented' } })],
    [
        'caller source head',
        (value) => ({ ...value, canonical_state: { head: { conversation_id: 'invented', revision: 0 } } }),
    ],
    [
        'caller namespace',
        (value) => ({ ...value, activity_delivery: { ...value.activity_delivery, namespace: 'foreign' } }),
    ],
    ['temporary prompt omitted', (value) => ({ ...value, request: { ...value.request, interaction: 'tmp:initial' } })],
];

describe('explicit initial-agent stream and admission wire parity', () => {
    test('valid initial bytes enter only the new named purpose and preserve ordinary authoring', () => {
        const bytes = JSON.parse(JSON.stringify(initial()));
        expect(ExperimentalCanonicalInitialAgentStreamRequestSchema.safeParse(bytes).success).toBe(true);
        expect(ExperimentalCanonicalInteractionStreamRequestSchema.safeParse(bytes).success).toBe(true);
        expect(validator('ExperimentalCanonicalInitialAgentStreamRequest')(bytes)).toBe(true);
        expect(validator('ExperimentalCanonicalInteractionStreamRequest')(bytes)).toBe(true);
        const admission = { operation: 'initial', request: bytes };
        expect(ExperimentalAdmitAgentGenerationPayloadSchema.safeParse(admission).success).toBe(true);
        expect(validator('ExperimentalAdmitAgentGenerationPayload')(admission)).toBe(true);
        const ordinary = {
            operation_id: 'ordinary:one',
            request: {
                interaction: 'agent:test',
                initial_state: { type: 'new' },
                retention: 'DEBUG',
                return_policy: { history: 'reference' },
            },
        };
        expect(ExperimentalCanonicalInteractionStreamRequestSchema.parse(ordinary)).toEqual(ordinary);
        expect(validator('ExperimentalCanonicalInteractionStreamRequest')(ordinary)).toBe(true);
        expect(
            validator('ExperimentalCanonicalInteractionStreamRequest')({
                ...ordinary,
                activity_delivery: bytes.activity_delivery,
            }),
        ).toBe(false);
    });
    test('rich scheduled authoring and delivery cursor survive the narrowing intersection unchanged', () => {
        const bytes = {
            ...initial(),
            resume_after: { stream_id: 'stream:initial', event_id: 'event:4', sequence: 4 },
            request: {
                ...initial().request,
                config: {
                    environment: 'environment:one',
                    model: 'model:one',
                    inference_profile: '507f1f77bcf86cd799439011',
                    model_options: { temperature: 0.25, max_tokens: 4096 },
                    prompt_cache_key: 'cache:one',
                },
                data: { prompt: 'Describe this image', nested: { explicit_null: null } },
                tags: ['initial', 'media'],
                workflow: {
                    run_id: 'actual:run',
                    workflow_id: 'actual:workflow',
                    agent_run_id: 'subject:one',
                    activity_type: 'startCanonicalConversation',
                },
                turn_selection: { mode: 'required', tool_name: 'describe_image' },
                initial_state: {
                    type: 'document',
                    document: {
                        ...document,
                        assets: {
                            picture: {
                                id: 'picture',
                                kind: 'image',
                                mime_type: 'image/png',
                                storage: { type: 'inline_base64', data: 'aW1hZ2U=' },
                                provenance: { type: 'received' },
                                byte_length: 5,
                                created_at: document.created_at,
                            },
                        },
                    },
                },
            },
        };
        expect(ExperimentalCanonicalInitialAgentStreamRequestSchema.parse(bytes)).toEqual(bytes);
        expect(ExperimentalCanonicalInteractionStreamRequestSchema.parse(bytes)).toEqual(bytes);
        expect(validator('ExperimentalCanonicalInitialAgentStreamRequest')(bytes)).toBe(true);
        expect(validator('ExperimentalCanonicalInteractionStreamRequest')(bytes)).toBe(true);
    });
    test.each(mutations)('%s rejects identical bytes in Zod and emitted AJV components', (_name, mutate) => {
        const bytes = JSON.parse(JSON.stringify(mutate(initial())));
        expect(ExperimentalCanonicalInitialAgentStreamRequestSchema.safeParse(bytes).success).toBe(false);
        expect(ExperimentalCanonicalInteractionStreamRequestSchema.safeParse(bytes).success).toBe(false);
        expect(validator('ExperimentalCanonicalInitialAgentStreamRequest')(bytes)).toBe(false);
        expect(validator('ExperimentalCanonicalInteractionStreamRequest')(bytes)).toBe(false);
        const admission = { operation: 'initial', request: bytes };
        expect(ExperimentalAdmitAgentGenerationPayloadSchema.safeParse(admission).success).toBe(false);
        expect(validator('ExperimentalAdmitAgentGenerationPayload')(admission)).toBe(false);
    });
});
