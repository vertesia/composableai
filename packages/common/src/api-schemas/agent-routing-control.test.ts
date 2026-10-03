import { validateApiRequest, validateApiResponse } from '@vertesia/common/api-contract';
import { describe, expect, it } from 'vitest';
import type { ExperimentalUpdateAgentRoutingControlPayload } from '../agent-routing-control.js';
import { EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE } from '../versions.js';
import {
    ExperimentalAgentRoutingChangeReceiptSchema,
    ExperimentalAgentRoutingControlChangeSchema,
    ExperimentalAgentRoutingInitialReceiptSchema,
    ExperimentalUpdateAgentRoutingControlPayloadSchema,
} from './agent-routing-control.js';

const request = {
    operation_id: 'routing:change:1',
    expected_revision: 0,
    recorded_at: '2026-10-02T00:00:00.000Z',
    change: { model: 'claude-sonnet-4-6' },
} satisfies ExperimentalUpdateAgentRoutingControlPayload;
const initial = {
    version: 2,
    kind: 'initial',
    origin_execution: { workflow_id: 'workflow:1', first_run_id: 'first:1' },
    owner: {
        account_id: 'account:1',
        project_id: 'project:1',
        subject_agent_run_id: 'agent:1',
        owner_agent_run_id: 'agent:1',
        scope: 'root',
        namespace_origin_first_run_id: 'first:1',
    },
    operation_id: 'routing:init',
    recorded_at: request.recorded_at,
    payload_fingerprint: 'fp:1',
    base_revision: 0,
    result_revision: 0,
    intent: {},
};
describe('registered exact-version routing-control contracts', () => {
    it.each([
        { model: 'model:1' },
        { effort: 'high' },
        { effort: null },
        { model: 'model:1', effort: null },
        { inference_profile: '6abeda318f2850f39cb91b86' },
        { inference_profile: '6abeda318f2850f39cb91b86', effort: null },
    ])('accepts model or effort, including an explicit clear, at installed AJV boundary', (change) => {
        const input = { ...request, change };
        expect(ExperimentalUpdateAgentRoutingControlPayloadSchema.safeParse(input).success).toBe(true);
        expect(validateApiRequest('ExperimentalUpdateAgentRoutingControlPayload', input).valid).toBe(true);
    });
    it.each([
        {},
        { model: '' },
        { inference_profile: '' },
        { inference_profile: null },
        { inference_profile: '6abeda318f2850f39cb91b86', model: 'mixed' },
        { model: ' \t\n' },
        { environment: 'old' },
        { model: 'valid', environment: 'old' },
        { model: 'valid', model_options: {} },
        { effort: 'old_alias' },
        { effort: null, cache: {} },
    ])('rejects malformed or mirrored changes in emitted runtime schema', (change) => {
        expect(ExperimentalAgentRoutingControlChangeSchema.safeParse(change).success).toBe(false);
        expect(validateApiRequest('ExperimentalUpdateAgentRoutingControlPayload', { ...request, change }).valid).toBe(
            false,
        );
    });
    it.each(['account_id', 'owner_agent_run_id', 'scope', 'workflow_id', 'model_options', 'environment'])(
        'rejects caller-owned outer %s',
        (key) => {
            expect(
                validateApiRequest('ExperimentalUpdateAgentRoutingControlPayload', { ...request, [key]: 'forged' })
                    .valid,
            ).toBe(false);
        },
    );
    it('retains strict discriminated initial and changed receipts with normalized null clearing', () => {
        const changed = {
            ...initial,
            kind: 'change',
            operation_id: 'routing:1',
            result_revision: 1,
            previous_receipt_id: initial.operation_id,
            change: { effort: null },
            intent: { model: 'model:1' },
        };
        for (const routing_control of [initial, changed, { ...changed, intent: { effort: null } }]) {
            expect(
                validateApiResponse('ExperimentalAgentRoutingControlResponse', {
                    api_version: EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
                    routing_control,
                }).valid,
            ).toBe(true);
        }
        for (const routing_control of [
            { ...initial, version: 1 },
            { ...initial, origin_execution: undefined },
            { ...initial, owner: { ...initial.owner, namespace_origin_first_run_id: undefined } },
            { ...initial, owner: { ...initial.owner, workflow_id: 'caller-selected-current' } },
            { ...initial, origin_execution: { ...initial.origin_execution, current_run_id: 'forged' } },
            { ...initial, change: { effort: null } },
            { ...changed, change: {} },
            { ...changed, previous_receipt_id: undefined },
            { ...changed, untrusted: true },
        ]) {
            expect(
                validateApiResponse('ExperimentalAgentRoutingControlResponse', {
                    api_version: EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
                    routing_control,
                }).valid,
            ).toBe(false);
        }
    });
    it('keeps named receipt branches strict at Zod and generated AJV boundaries', () => {
        const changed = {
            ...initial,
            kind: 'change',
            result_revision: 1,
            previous_receipt_id: initial.operation_id,
            change: { effort: null },
        } as const;
        for (const [name, schema, value] of [
            ['ExperimentalAgentRoutingInitialReceipt', ExperimentalAgentRoutingInitialReceiptSchema, initial],
            ['ExperimentalAgentRoutingChangeReceipt', ExperimentalAgentRoutingChangeReceiptSchema, changed],
        ] as const) {
            expect(schema.safeParse(value).success).toBe(true);
            expect(validateApiResponse(name, value).valid).toBe(true);
        }
        for (const value of [
            { ...initial, kind: undefined },
            { ...initial, kind: 'future' },
            { ...changed, previous_receipt_id: undefined },
            { ...changed, change: undefined },
            { ...changed, change: null },
        ]) {
            expect(ExperimentalAgentRoutingInitialReceiptSchema.safeParse(value).success).toBe(false);
            expect(ExperimentalAgentRoutingChangeReceiptSchema.safeParse(value).success).toBe(false);
            expect(validateApiResponse('ExperimentalAgentRoutingControlReceipt', value).valid).toBe(false);
        }
    });
    it('requires control access for an immutable receipt selector and exact response version', () => {
        expect(
            validateApiRequest('ExperimentalAgentRoutingControlQuery', {
                access: 'control',
                routing_control_operation_id: 'routing:1',
            }).valid,
        ).toBe(true);
        expect(validateApiRequest('ExperimentalAgentRoutingControlQuery', { access: 'read' }).valid).toBe(false);
        expect(validateApiRequest('ExperimentalAgentRoutingControlQuery', {}).valid).toBe(false);
        expect(
            validateApiResponse('ExperimentalAgentRoutingControlResponse', {
                api_version: '20260930',
                routing_control: initial,
            }).valid,
        ).toBe(false);
    });
    it('preserves the stable lifecycle status contract', () => {
        expect(
            validateApiRequest('UpdateAgentRunStatusPayload', { status: 'running', title: 'Existing lifecycle' }).valid,
        ).toBe(true);
        // Stable legacy validation has its established unknown-property policy; routing dispatch still requires exact version.
        expect(validateApiRequest('UpdateAgentRunStatusPayload', {}).valid).toBe(true);
    });
});

describe('registered generation admission and status union', () => {
    const admit = {
        kind: 'generation_admission',
        request_id: 'request:1',
        input_fingerprint: 'input:1',
        control: { operation_id: initial.operation_id, revision: 0 },
    };
    const receipt = {
        version: 1,
        request_id: admit.request_id,
        input_fingerprint: admit.input_fingerprint,
        admitted_at: request.recorded_at,
        execution: { workflow_id: 'actual:workflow', chain_first_run_id: 'actual:chain' },
        routing_control: initial,
    };
    it('enforces both strict branches at installed standalone AJV boundary', () => {
        expect(validateApiRequest('ExperimentalAgentRoutingStatusPayload', admit).valid).toBe(true);
        expect(
            validateApiRequest('ExperimentalAgentRoutingStatusPayload', {
                kind: 'routing_control_change',
                command: { ...request, change: { effort: null } },
            }).valid,
        ).toBe(true);
        for (const value of [
            request,
            { ...admit, workflow_id: 'caller' },
            { ...admit, execution: receipt.execution },
            { ...admit, command: request },
            { ...admit, control: { ...admit.control, environment: 'caller' } },
            { ...admit, control: { operation_id: initial.operation_id } },
            { ...admit, kind: 'routing_control_change' },
            { kind: 'routing_control_change', command: request, request_id: 'mixed' },
        ])
            expect(validateApiRequest('ExperimentalAgentRoutingStatusPayload', value).valid).toBe(false);
    });
    it('retains server-derived exact execution and rejects caller aliases/invalid nested control', () => {
        const response = {
            kind: 'generation_admission',
            api_version: EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
            generation_admission: receipt,
        };
        expect(validateApiResponse('ExperimentalAgentRoutingStatusResponse', response).valid).toBe(true);
        expect(
            validateApiResponse('ExperimentalAgentRoutingStatusResponse', {
                kind: 'routing_control_change',
                api_version: response.api_version,
                routing_control: initial,
            }).valid,
        ).toBe(true);
        for (const generation_admission of [
            { ...receipt, execution: { ...receipt.execution, run_id: 'alias' } },
            { ...receipt, execution: { workflow_id: 'caller' } },
            { ...receipt, model_options: {} },
            { ...receipt, routing_control: { ...initial, origin_execution: undefined } },
            { ...receipt, version: 2 },
        ])
            expect(
                validateApiResponse('ExperimentalAgentRoutingStatusResponse', { ...response, generation_admission })
                    .valid,
            ).toBe(false);
        expect(
            validateApiResponse('ExperimentalAgentRoutingStatusResponse', { ...response, routing_control: initial })
                .valid,
        ).toBe(false);
    });
});
