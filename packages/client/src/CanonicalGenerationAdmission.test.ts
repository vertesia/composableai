import {
    appendConversationRecords,
    createAcceptedOutputFragment,
    createConversationDocument,
} from '@llumiverse/conversation';
import type {
    ExperimentalAgentGenerationAdmissionReceipt,
    ExperimentalCanonicalInteractionExecutionResult,
} from '@vertesia/common';
import { ExecutionRunStatus, RunDataStorageLevel } from '@vertesia/common';
import { expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

const at = '2026-10-02T00:00:00.000Z';
const receipt: ExperimentalAgentGenerationAdmissionReceipt = {
    version: 1,
    request_id: 'request:actual',
    input_fingerprint: 'input:actual',
    admitted_at: at,
    execution: { workflow_id: 'workflow:actual', chain_first_run_id: 'chain:actual' },
    routing_control: {
        version: 2,
        kind: 'initial',
        operation_id: 'routing:actual',
        payload_fingerprint: 'routing:hash',
        recorded_at: at,
        base_revision: 0,
        result_revision: 0,
        intent: { model: 'model:actual' },
        owner: {
            account_id: 'account:1',
            project_id: 'project:1',
            subject_agent_run_id: 'agent:1',
            owner_agent_run_id: 'agent:1',
            scope: 'root',
            namespace_origin_first_run_id: 'origin:1',
        },
        origin_execution: { workflow_id: 'origin:workflow', first_run_id: 'origin:1' },
    },
};

it('preserves returned durable admission metadata through canonical HTTP retrieval without constructing a receipt', async () => {
    const response: ExperimentalCanonicalInteractionExecutionResult = {
        run: {
            id: 'run:actual',
            status: ExecutionRunStatus.completed,
            created_at: at,
            updated_at: at,
            retention: RunDataStorageLevel.STANDARD,
        },
        output: { status: 'unavailable', reason: 'no_accepted_response' },
        history: { status: 'unavailable', reason: 'not_requested', retention: RunDataStorageLevel.STANDARD },
        generation_admission: receipt,
    };
    const source = createConversationDocument({ id: 'conversation:actual', created_at: at });
    const document = appendConversationRecords(
        source,
        {
            generations: [
                {
                    id: 'generation:actual',
                    record_source: 'executed',
                    request_id: receipt.request_id,
                    attempt_id: 'attempt:actual',
                    purpose: 'conversation',
                    requested_model: 'model:actual',
                    provider: 'provider:actual',
                    protocol: 'protocol:actual',
                    adapter_version: '1',
                    status: 'completed',
                    source: { conversation_id: source.id, revision: 0 },
                    timestamps: { recorded_at: at },
                    request_receipt: {
                        id: 'prepared:actual',
                        request_id: receipt.request_id,
                        attempt_id: 'attempt:actual',
                        source: { conversation_id: source.id, revision: 0 },
                        context_fingerprint: 'context:actual',
                        tool_set_fingerprint: 'tools:actual',
                        request_fingerprint: 'request:actual',
                        target: {
                            provider: 'provider:actual',
                            protocol: 'protocol:actual',
                            model: 'model:actual',
                            adapter_version: '1',
                        },
                        tool_definition_ids: [],
                        asset_versions: [],
                        item_mappings: [],
                        recorded_at: at,
                    },
                },
            ],
            turns: [
                {
                    id: 'turn:actual',
                    kind: 'agent',
                    authority: 'ordinary',
                    model_visibility: 'include',
                    status: 'completed',
                    generation_id: 'generation:actual',
                    timestamps: { recorded_at: at },
                    provenance: { type: 'generated' },
                    blocks: [{ id: 'text:actual', type: 'text', text: 'Answer', format: 'plain' }],
                },
            ],
        },
        { expected_revision: 0, operation_id: 'response:actual', payload_fingerprint: 'output:hash', recorded_at: at },
    ).document;
    response.output = { status: 'accepted', fragment: createAcceptedOutputFragment(document, 'response:actual') };
    const client = new VertesiaClient({
        serverUrl: 'https://studio.example.test',
        storeUrl: 'https://store.example.test',
        fetch: vi.fn(async () => Response.json(response)),
    });
    const result = await client.runs.retrieveCanonical('run:actual');
    expect(result.generation_admission).toEqual(receipt);
    expect(result.canonicalOutput?.text()).toBe('Answer');
    expect(result.output).not.toHaveProperty('generation_admission');
});
