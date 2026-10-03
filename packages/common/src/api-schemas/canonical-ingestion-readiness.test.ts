import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
    ExperimentalCanonicalIngestionPreparationViewResponseSchema,
    ExperimentalCanonicalIngestionRecoverySchema,
    ExperimentalCanonicalIngestionRecoveryViewQuerySchema,
    ExperimentalCanonicalIngestionRecoveryViewResponseSchema,
    ExperimentalRunConversationInspectionQuerySchema,
    ExperimentalRunConversationInspectionResponseSchema,
} from './canonical-ingestion-readiness.js';
import { ApiSchemaComponents } from './registry.js';
import { ExperimentalInitialAuthoringViewResponseSchema } from './run-conversation.js';

const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
addFormats.default(ajv);
const validator = (component: keyof typeof ApiSchemaComponents) =>
    ajv.compile({
        components: { schemas: ApiSchemaComponents },
        $ref: `#/components/schemas/${component}`,
    });
const validate = validator('ExperimentalCanonicalIngestionRecovery');
const validateQuery = validator('ExperimentalCanonicalIngestionRecoveryViewQuery');
const hash = `sha256:${'a'.repeat(64)}`;
// Wire shape only. Server authorization must independently load real retained evidence.
const recovery = {
    version: 1,
    execution_run_id: 'operational-run',
    account_id: 'account',
    project_id: 'project',
    subject_agent_run_id: 'subject',
    owner_agent_run_id: 'owner',
    scope: 'root',
    admission_request_id: 'admitted-request',
    scheduled_semantic_fingerprint: hash,
    target_reference: { key: 'host-target-key', fingerprint: hash },
    runtime: {
        conversation_id: 'conversation',
        request_id: 'request',
        attempt_id: 'original-attempt',
        input_operation_id: 'input',
        response_operation_id: 'response',
        purpose: 'conversation',
    },
    source: { conversation_id: 'conversation', revision: 2 },
    request_receipt_id: 'prepared-receipt',
    prepared_record_fingerprint: hash,
    native_request_fingerprint: hash,
    context_fingerprint: hash,
    tool_set_fingerprint: hash,
    concrete_target: {
        provider: 'openai_compatible',
        protocol: 'openai.chat.completions',
        model: 'gpt-4o',
        adapter_version: '1',
    },
    target_fingerprint: hash,
    recorded_at: '2026-10-03T00:00:00Z',
};
const query = { view: 'ingestion_recovery', target_key: 'host-target-key', request_id: 'request' };

describe('bounded retained canonical preparation inspection', () => {
    it('round-trips server-selected original attempt without exposing native input or a ready capability', () => {
        expect(ExperimentalCanonicalIngestionRecoverySchema.parse(recovery)).toEqual(recovery);
        expect(validate(recovery)).toBe(true);
        expect(
            ExperimentalCanonicalIngestionRecoveryViewResponseSchema.parse({
                status: 'recovery_available',
                recovery,
            }),
        ).toEqual({ status: 'recovery_available', recovery });
        expect(
            ExperimentalCanonicalIngestionRecoveryViewResponseSchema.parse({
                status: 'recovery_unavailable',
                reason: 'not_recorded',
            }),
        ).toEqual({ status: 'recovery_unavailable', reason: 'not_recorded' });
        expect(ExperimentalCanonicalIngestionRecoveryViewQuerySchema.parse(query)).toEqual(query);
        expect(ExperimentalRunConversationInspectionQuerySchema.parse(query)).toEqual(query);
        expect(validateQuery(query)).toBe(true);
    });

    it('round-trips the server-owned accepted-output fingerprint without granting fresh source authority', () => {
        const value = { ...recovery, accepted_output_fingerprint: hash };
        expect(ExperimentalCanonicalIngestionRecoverySchema.parse(value)).toEqual(value);
        expect(validate(value)).toBe(true);
        const malformed = { ...recovery, accepted_output_fingerprint: 17 };
        expect(ExperimentalCanonicalIngestionRecoverySchema.safeParse(malformed).success).toBe(false);
        expect(validate(malformed)).toBe(false);
    });

    it.each(['document', 'native_request', 'generation_admission', 'ready', 'model_options', 'current_execution'])(
        'rejects undeclared %s data or authority from retained inspection',
        (field) => {
            const invalid = { ...recovery, [field]: {} };
            expect(ExperimentalCanonicalIngestionRecoverySchema.safeParse(invalid).success).toBe(false);
            expect(validate(invalid)).toBe(false);
        },
    );
    it.each(['source', 'request_receipt_id', 'target_reference', 'prepared_record_fingerprint', 'runtime'])(
        'rejects absent %s instead of permitting recovery as a fresh bypass',
        (field) => {
            const invalid: Record<string, unknown> = { ...recovery };
            delete invalid[field];
            expect(ExperimentalCanonicalIngestionRecoverySchema.safeParse(invalid).success).toBe(false);
            expect(validate(invalid)).toBe(false);
        },
    );
    it('does not allow a retry to nominate attempt, source, target facts or output content', () => {
        for (const extra of [
            { attempt_id: 'new-temporal-attempt' },
            { source: recovery.source },
            { target: recovery.concrete_target },
            { output: {} },
        ]) {
            const invalid = { ...query, ...extra };
            expect(ExperimentalCanonicalIngestionRecoveryViewQuerySchema.safeParse(invalid).success).toBe(false);
            expect(validateQuery(invalid)).toBe(false);
        }
        for (const invalid of [
            { ...recovery, accepted_output: null },
            { ...recovery, runtime: { ...recovery.runtime, admission: {} } },
            { ...recovery, concrete_target: { ...recovery.concrete_target, options: {} } },
            { ...recovery, source: { conversation_id: 'conversation', revision: -1 } },
        ]) {
            expect(ExperimentalCanonicalIngestionRecoverySchema.safeParse(invalid).success).toBe(false);
            expect(validate(invalid)).toBe(false);
        }
    });
});

// Wire validators only. These data fixtures do not assert host authority, live admission or readiness.
describe('flat run inspection response compatibility', () => {
    const previous = z.union([
        ExperimentalInitialAuthoringViewResponseSchema,
        ExperimentalCanonicalIngestionPreparationViewResponseSchema,
        ExperimentalCanonicalIngestionRecoveryViewResponseSchema,
    ]);
    const inspect = validator('ExperimentalRunConversationInspectionResponse');
    const at = '2026-10-03T00:00:00Z';
    const projection = {
        version: 1,
        id: hash,
        execution_run_id: recovery.execution_run_id,
        account_id: recovery.account_id,
        project_id: recovery.project_id,
        subject_agent_run_id: recovery.subject_agent_run_id,
        owner_agent_run_id: recovery.owner_agent_run_id,
        scope: 'root',
        admission_request_id: recovery.admission_request_id,
        scheduled_semantic_fingerprint: hash,
        target_reference: recovery.target_reference,
        source: recovery.source,
        source_document_fingerprint: hash,
        source_processing_fingerprint: hash,
        context_fingerprint: hash,
        concrete_target: recovery.concrete_target,
        target_fingerprint: hash,
        request_id: 'request',
        attempt_id: 'attempt',
        input_operation_id: 'input',
        response_operation_id: 'response',
        coverage_operation_id: 'coverage',
        measurement_fingerprint: hash,
        recorded_at: at,
        count: {
            counted_request_fingerprint: hash,
            measurement: {
                input_tokens: 12,
                method: 'estimated',
                tokenizer: 'full-native-json-bpe-v1',
                tokenizer_version: '1',
                adapter: 'openai.chat.completions',
                adapter_version: '1',
                source_fingerprint: hash,
                target_model: 'gpt-4o',
                measured_at: at,
            },
            readiness: { profile: 'full-native-json-bpe-v1', context_limit: 128000, output_reserve_tokens: 4 },
        },
    };
    const input = {
        version: 1,
        run_id: 'run',
        account_id: 'account',
        project_id: 'project',
        retention: 'DEBUG',
        subject_agent_run_id: 'subject',
        owner_agent_run_id: 'owner',
        scope: 'root',
        scheduled_semantic_fingerprint: hash,
        initializer_source: { conversation_id: 'conversation', revision: 0 },
        input_operation_id: 'input',
        base_revision: 0,
        recorded_at: at,
        definition_fingerprint: hash,
        parameters_fingerprint: hash,
        rendered_at: at,
        segments: [],
        records_fingerprint: hash,
    };
    const values = [
        { status: 'available', input },
        { status: 'unavailable', reason: 'not_recorded' },
        { status: 'preparation_available', projection },
        { status: 'preparation_unavailable', reason: 'not_recorded' },
        { status: 'recovery_available', recovery },
        { status: 'recovery_unavailable', reason: 'not_recorded' },
    ];
    it('retains all six original strict branches in Zod and generated AJV', () => {
        expect(ExperimentalRunConversationInspectionResponseSchema.options).toHaveLength(6);
        for (const value of values) {
            expect(previous.parse(value)).toEqual(value);
            expect(ExperimentalRunConversationInspectionResponseSchema.parse(value)).toEqual(value);
            expect(inspect(value), JSON.stringify(inspect.errors)).toBe(true);
        }
        const retentionUnavailable = { status: 'unavailable', reason: 'retention_policy' };
        expect(previous.parse(retentionUnavailable)).toEqual(retentionUnavailable);
        expect(ExperimentalRunConversationInspectionResponseSchema.parse(retentionUnavailable)).toEqual(
            retentionUnavailable,
        );
        expect(inspect(retentionUnavailable)).toBe(true);
    });
    it('rejects mixed view payloads, missing members and unknown fields as before', () => {
        for (const value of values) {
            for (const invalid of [
                { ...value, status: 'unknown' },
                { ...value, admission: {} },
                { ...value, status: value.status === 'available' ? 'recovery_available' : 'available' },
                { ...value, status: 'recovery_unavailable' },
            ]) {
                // Changing the unavailable status alone may be another legitimate unavailable branch.
                const expected = previous.safeParse(invalid).success;
                expect(ExperimentalRunConversationInspectionResponseSchema.safeParse(invalid).success).toBe(expected);
                expect(inspect(invalid)).toBe(expected);
            }
        }
        for (const invalid of [
            {},
            { status: 'available' },
            { status: 'preparation_available' },
            { status: 'recovery_available' },
            { status: 'preparation_available', recovery },
            { status: 'recovery_available', projection },
            { status: 'unavailable', reason: 'not_recorded', input },
        ]) {
            expect(previous.safeParse(invalid).success).toBe(false);
            expect(ExperimentalRunConversationInspectionResponseSchema.safeParse(invalid).success).toBe(false);
            expect(inspect(invalid)).toBe(false);
        }
    });
});

describe('named flat inspection response leaves', () => {
    it('publishes six named references so generated clients retain every unique status discriminator', () => {
        const response = ApiSchemaComponents.ExperimentalRunConversationInspectionResponse;
        expect(response.oneOf ?? response.anyOf).toEqual([
            { $ref: '#/components/schemas/AvailableInitialAuthoringView' },
            { $ref: '#/components/schemas/UnavailableInitialAuthoringView' },
            { $ref: '#/components/schemas/AvailableCanonicalIngestionPreparationView' },
            { $ref: '#/components/schemas/UnavailableCanonicalIngestionPreparationView' },
            { $ref: '#/components/schemas/AvailableCanonicalIngestionRecoveryView' },
            { $ref: '#/components/schemas/UnavailableCanonicalIngestionRecoveryView' },
        ]);
    });
    it.each([
        ['UnavailableCanonicalIngestionPreparationView', 'preparation_unavailable'],
        ['UnavailableCanonicalIngestionRecoveryView', 'recovery_unavailable'],
    ] as const)('keeps %s strictly bound to its own literal status', (name, status) => {
        const check = validator(name);
        expect(check({ status, reason: 'not_recorded' })).toBe(true);
        for (const invalid of [
            { status: 'unavailable', reason: 'not_recorded' },
            { status: 'unknown', reason: 'not_recorded' },
            { reason: 'not_recorded' },
            { status, reason: 'not_recorded', admission: {} },
        ])
            expect(check(invalid)).toBe(false);
    });
});
