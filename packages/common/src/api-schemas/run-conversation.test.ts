import { PromptRole } from '@llumiverse/common';
import { createConversationDocument, createUserTurn } from '@llumiverse/conversation';
import {
    ConversationAcceptedOutputFragmentSchema,
    ConversationDocumentSchema,
    ConversationMaterializedInputSchema,
    ConversationModelSwitchPlanSchema,
    ConversationStreamCursorSchema,
    ConversationStreamDecodeEvidenceSchema,
    ConversationStreamEventSchema,
    ConversationStreamIdentitySchema,
    ConversationStreamResponseMappingSchema,
    ConversationStreamTransformationProofSchema,
    ConversationToolExecutionRequestSchema,
    ConversationToolExecutionResultSchema,
    ConversationTranscriptExternalReferenceBlockSchema,
    ConversationTranscriptFragmentSchema,
    JsonMinificationApplicationSchema,
    JsonMinificationMeasuredProjectionSchema,
    JsonMinificationMeasurementSchema,
    JsonMinificationNoOpReasonSchema,
    JsonMinificationProposalSchema,
    JsonMinificationTransformSchema,
} from '@llumiverse/conversation/schemas';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { validateApiRequest, validateApiResponse } from '../api-contract/index.js';
import { RunDataStorageLevel } from '../interaction-values.js';
import { CANONICAL_CONVERSATION_SCHEMAS } from './canonical-conversation.js';
import {
    ExperimentalInitialAuthoringViewQuerySchema,
    ExperimentalInitialAuthoringViewResponseSchema,
    InitialAuthoringInputRecordSchema,
    RunConversationResponseSchema,
} from './run-conversation.js';

function availableHistory() {
    const at = '2026-09-12T00:00:00.000Z';
    const conversation = createConversationDocument({ id: 'history', created_at: at });
    conversation.turns.push(
        createUserTurn({
            id: 'user',
            authority: 'ordinary',
            status: 'completed',
            model_visibility: 'include',
            provenance: { type: 'received' },
            timestamps: { recorded_at: at },
            blocks: [{ id: 'json', type: 'json', value: { nested: [null, true, { message: 'original' }] } }],
        }),
    );
    return { status: 'available', conversation } as const;
}

describe('run conversation wire contract', () => {
    it('keeps the complete named canonical schema closure strict and publicly owned', () => {
        const definitions = new Set<string>();
        for (const schema of [
            ConversationDocumentSchema,
            ConversationAcceptedOutputFragmentSchema,
            ConversationToolExecutionRequestSchema,
            ConversationToolExecutionResultSchema,
            ConversationMaterializedInputSchema,
            ConversationModelSwitchPlanSchema,
            ConversationStreamIdentitySchema,
            ConversationStreamCursorSchema,
            ConversationStreamEventSchema,
            ConversationStreamResponseMappingSchema,
            ConversationStreamTransformationProofSchema,
            ConversationStreamDecodeEvidenceSchema,
            ConversationTranscriptFragmentSchema,
            ConversationTranscriptExternalReferenceBlockSchema,
            JsonMinificationTransformSchema,
            JsonMinificationMeasuredProjectionSchema,
            JsonMinificationMeasurementSchema,
            JsonMinificationProposalSchema,
            JsonMinificationNoOpReasonSchema,
            JsonMinificationApplicationSchema,
        ]) {
            const emitted = schema.toJSONSchema({ target: 'draft-2020-12', io: 'input' });
            for (const name of Object.keys(emitted.$defs ?? {})) definitions.add(name);
        }
        expect(Object.keys(CANONICAL_CONVERSATION_SCHEMAS).sort()).toEqual([...definitions].sort());
    });

    it('preserves recursive JSON and matches runtime enforcement', () => {
        const response = availableHistory();
        expect(RunConversationResponseSchema.parse(response)).toEqual(response);
        expect(validateApiResponse('RunConversationResponse', response)).toMatchObject({ valid: true });
    });

    it.each(['not_recorded', 'retention_policy', 'pruned'] as const)(
        'reports %s without pretending history exists',
        (reason) => {
            const response = { status: 'unavailable', reason };
            expect(RunConversationResponseSchema.safeParse(response).success).toBe(true);
            expect(validateApiResponse('RunConversationResponse', response)).toMatchObject({ valid: true });
        },
    );

    it.each([
        { ...availableHistory(), artifact: { path: 'private' } },
        { status: 'unavailable', reason: 'retention_policy', conversation: availableHistory().conversation },
        { status: 'available', conversation: { ...availableHistory().conversation, unexpected: true } },
        { status: 'unavailable', reason: 'unknown' },
    ])('rejects undocumented data at both validation boundaries', (response) => {
        expect(RunConversationResponseSchema.safeParse(response).success).toBe(false);
        expect(validateApiResponse('RunConversationResponse', response).valid).toBe(false);
    });

    it('rejects unknown properties inside canonical content blocks', () => {
        const response = availableHistory();
        const block = response.conversation.turns[0]?.blocks[0];
        expect(block).toBeDefined();
        if (!block) throw new Error('Fixture must contain a content block');
        Object.assign(block, { private_locator: 'not a canonical field' });
        expect(RunConversationResponseSchema.safeParse(response).success).toBe(false);
        expect(validateApiResponse('RunConversationResponse', response).valid).toBe(false);
    });
});

describe('initial authoring inspection contract', () => {
    const record = {
        version: 1,
        run_id: 'run',
        account_id: 'account',
        project_id: 'project',
        retention: RunDataStorageLevel.DEBUG,
        subject_agent_run_id: 'subject',
        owner_agent_run_id: 'owner',
        scope: 'root',
        scheduled_semantic_fingerprint: `sha256:${'a'.repeat(64)}`,
        initializer_source: { conversation_id: 'conversation', revision: 0 },
        input_operation_id: 'input',
        base_revision: 0,
        recorded_at: '2026-10-03T00:00:00.000Z',
        definition_fingerprint: `sha256:${'b'.repeat(64)}`,
        parameters_fingerprint: `sha256:${'c'.repeat(64)}`,
        authoring_model: 'gpt-5.4',
        rendered_at: '2026-10-03T00:00:00.000Z',
        segments: [
            {
                role: PromptRole.user,
                content: 'rendered once',
                files: [
                    {
                        name: 'image.png',
                        mime_type: 'image/png',
                        data_base64: 'aGk=',
                        byte_length: 2,
                        content_hash: `sha256:${'d'.repeat(64)}`,
                    },
                ],
            },
        ],
        records_fingerprint: `sha256:${'e'.repeat(64)}`,
    } as const;

    it('publishes the exact bounded record through runtime response enforcement', () => {
        const response = { status: 'available', input: record };
        expect(InitialAuthoringInputRecordSchema.safeParse(record).success).toBe(true);
        expect(ExperimentalInitialAuthoringViewResponseSchema.safeParse(response).success).toBe(true);
        expect(validateApiResponse('ExperimentalInitialAuthoringViewResponse', response).valid).toBe(true);
    });

    it('closes query and nested response objects without accepting a locator', () => {
        expect(ExperimentalInitialAuthoringViewQuerySchema.safeParse({ view: 'initial_authoring' }).success).toBe(true);
        expect(validateApiRequest('ExperimentalInitialAuthoringViewQuery', { view: 'other' }).valid).toBe(false);
        expect(
            validateApiRequest('ExperimentalInitialAuthoringViewQuery', { view: 'initial_authoring', extra: 1 }).valid,
        ).toBe(false);
        expect(
            validateApiResponse('ExperimentalInitialAuthoringViewResponse', {
                status: 'available',
                input: { ...record, artifact: { path: 'private' } },
            }).valid,
        ).toBe(false);
        expect(
            validateApiResponse('ExperimentalInitialAuthoringViewResponse', {
                status: 'available',
                input: {
                    ...record,
                    segments: [{ ...record.segments[0], files: [{ ...record.segments[0].files[0], path: 'private' }] }],
                },
            }).valid,
        ).toBe(false);
        expect(
            validateApiResponse('ExperimentalInitialAuthoringViewResponse', {
                status: 'available',
                input: { ...record, records_fingerprint: 'arbitrary-nonempty' },
            }).valid,
        ).toBe(false);
        expect(
            validateApiResponse('ExperimentalInitialAuthoringViewResponse', {
                status: 'available',
                input: {
                    ...record,
                    segments: [
                        {
                            ...record.segments[0],
                            files: [{ ...record.segments[0].files[0], content_hash: 'arbitrary-nonempty' }],
                        },
                    ],
                },
            }).valid,
        ).toBe(false);
    });

    it('distinguishes absence from corrupt retained evidence', () => {
        expect(
            validateApiResponse('ExperimentalInitialAuthoringViewResponse', {
                status: 'unavailable',
                reason: 'not_recorded',
            }).valid,
        ).toBe(true);
        expect(
            validateApiResponse('ExperimentalInitialAuthoringViewResponse', {
                status: 'unavailable',
                reason: 'retention_policy',
            }).valid,
        ).toBe(true);
        expect(
            validateApiResponse('ExperimentalInitialAuthoringViewResponse', { status: 'unavailable', reason: 'pruned' })
                .valid,
        ).toBe(false);
    });
});

it('keeps shared transcript original cues strict in Zod, AJV and exported SDK types', () => {
    const cue: import('../canonical-conversation.js').ConversationTranscriptExternalReferenceBlock = {
        id: 'block:original',
        type: 'external_reference',
        asset_id: 'asset:original',
        original_type: 'json',
        description: 'Archived original',
        content_hash: 'sha256:original',
        preview: '{"nested":[null,true]}',
    };
    expectTypeOf<typeof cue>().toEqualTypeOf<
        import('zod').z.infer<typeof ConversationTranscriptExternalReferenceBlockSchema>
    >();
    expect(ConversationTranscriptExternalReferenceBlockSchema.parse(JSON.parse(JSON.stringify(cue)))).toEqual(cue);
    expect(validateApiResponse('ConversationTranscriptExternalReferenceBlock', cue).valid).toBe(true);
    for (const [name, value] of [
        ['private resolver', { ...cue, resolver: 'private' }],
        [
            'private retrieval',
            { ...cue, retrieval: { capability: 'read_artifact', version: 1, arguments: { path: 'private' } } },
        ],
        ['oversized preview', { ...cue, preview: 'x'.repeat(513) }],
        ['oversized description', { ...cue, description: 'x'.repeat(513) }],
        ['missing hash', { ...cue, content_hash: undefined }],
    ] as const) {
        expect(ConversationTranscriptExternalReferenceBlockSchema.safeParse(value).success, name).toBe(false);
        expect(validateApiResponse('ConversationTranscriptExternalReferenceBlock', value).valid, name).toBe(false);
    }
    const absent = { ...cue };
    delete absent.preview;
    expect(ConversationTranscriptExternalReferenceBlockSchema.parse(absent)).not.toHaveProperty('preview');
});
