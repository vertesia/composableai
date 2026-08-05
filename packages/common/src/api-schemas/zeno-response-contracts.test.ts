import { describe, expect, it } from 'vitest';
import { validateApiRequest, validateApiResponse } from './registry.js';

const timestamp = '2026-08-05T12:00:00.000Z';

const contentObject = {
    id: '64b000000000000000000001',
    name: 'Quarterly report',
    updated_by: 'user:legacy',
    created_by: 'user:legacy',
    created_at: timestamp,
    updated_at: timestamp,
    location: '/Quarterly report',
    status: 'ready',
    properties: {},
    revision: { root: '64b000000000000000000001', head: true },
    sensitivity: 2,
    compartments: ['finance'],
};

const autonomousRun = {
    id: '64b000000000000000000002',
    account: '64b000000000000000000003',
    project: '64b000000000000000000004',
    run_kind: 'agent',
    run_type: 'autonomous',
    status: 'running',
    started_by: 'user:legacy',
    started_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    interaction: 'sys:generic_question',
    interactionRef: {
        id: 'sys:generic_question',
        name: 'Generic question',
        endpoint: 'sys:generic_question',
        status: 'code',
        version: 0,
        tags: [],
        updated_at: timestamp,
    },
    environmentRef: {
        id: '64b000000000000000000005',
        name: 'Default',
        type: 'environment',
    },
    config: {
        environment: '64b000000000000000000005',
        model: 'legacy-provider/model',
        model_options: { temperature: 0.2, provider_extension: true },
    },
    interactive: true,
};

const processRun = {
    id: '64b000000000000000000009',
    account: '64b000000000000000000003',
    project: '64b000000000000000000004',
    run_kind: 'process',
    run_type: 'programmatic',
    status: 'running',
    started_by: 'user:legacy',
    started_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    process_definition_snapshot: {
        process: 'Legacy process',
        initial: 'start',
        nodes: { start: { type: 'branch', branches: [{ to: 'done', condition: true }] } },
    },
    process_state: {
        context: {},
        current_node: 'start',
        node_history: [],
        node_history_ref: { path: 'history', latest_sequence: 0, count: 0 },
        sequence: 0,
    },
};

describe('Zeno read-side response contracts', () => {
    it('keeps the corresponding write contracts strict', () => {
        expect(
            validateApiRequest('CreateAgentRunPayload', {
                interaction: 'sys:generic_question',
                config: {
                    environment: '64b000000000000000000005',
                    model: 'legacy-provider/model',
                    model_options: { provider_extension: true },
                },
            }).valid,
        ).toBe(false);
        expect(
            validateApiRequest('CreateProcessDefinitionPayload', {
                name: 'Legacy process',
                definition: { process: 'Legacy', initial: 'start', context: {}, nodes: {} },
            }).valid,
        ).toBe(false);
    });

    it('accepts autonomous runs, legacy model options, and projected refs', () => {
        expect(validateApiResponse('AgentRun', autonomousRun).valid).toBe(true);
        expect(validateApiResponse('AgentRunResponse', autonomousRun).valid).toBe(true);
        expect(validateApiResponse('AgentRunResponse', processRun).valid).toBe(true);
        expect(
            validateApiResponse('ListAgentRunsResponse', {
                items: [autonomousRun],
                total_count: 1,
                next_cursor: null,
            }).valid,
        ).toBe(true);
    });

    it('accepts historical compact messages without weakening update requests', () => {
        const response = { messages: [{ t: 2, d: { files: { legacy: true } }, historical: true }] };
        expect(validateApiResponse('AgentRunUpdatesResponse', response).valid).toBe(true);
        expect(validateApiResponse('WorkflowRunUpdatesResponse', response).valid).toBe(true);
    });

    it('accepts normalized legacy collections and full or projected content objects', () => {
        expect(
            validateApiResponse('CollectionArray', [
                {
                    id: '64b000000000000000000006',
                    name: 'Legacy',
                    created_by: '',
                    updated_by: '',
                    created_at: timestamp,
                    updated_at: timestamp,
                    dynamic: false,
                    status: 'active',
                    skip_head_sync: false,
                    parents: ['64b000000000000000000007'],
                },
            ]).valid,
        ).toBe(true);
        expect(validateApiResponse('ContentObjectApiResponse', contentObject).valid).toBe(true);
        expect(validateApiResponse('ContentObjectApiResponseArray', [contentObject]).valid).toBe(true);
        expect(validateApiResponse('ContentObjectItemApiResponseArray', [contentObject]).valid).toBe(true);
        expect(validateApiResponse('ProjectedContentObjectApiResponse', { id: contentObject.id, score: 1 }).valid).toBe(
            true,
        );
        expect(
            validateApiResponse('ObjectSearchResponse', {
                results: [{ id: contentObject.id, score: 1 }],
                facets: { total: 1 },
            }).valid,
        ).toBe(true);
    });

    it('accepts explicit file, embedding, facet, and data-table wire objects', () => {
        expect(
            validateApiResponse('FileMetadataResponse', {
                name: 'report.pdf',
                size: 42,
                contentType: 'application/pdf',
                generation: '7',
            }).valid,
        ).toBe(true);
        expect(
            validateApiResponse('SetObjectEmbeddingsResponse', {
                type: { model: 'embed-v1', values: [0.1, 0.2], etag: 'abc' },
            }).valid,
        ).toBe(true);
        expect(
            validateApiResponse('ComputedFacetResponse', { total: 3, status: [{ _id: 'ready', count: 3 }] }).valid,
        ).toBe(true);
        expect(
            validateApiResponse('DataTable', {
                name: 'invoices',
                columns: [{ name: 'id', type: 'STRING' }],
                tags: [],
                created_at: timestamp,
                updated_at: timestamp,
            }).valid,
        ).toBe(true);
    });

    it('accepts workflow memo, children, and historical interaction snapshots', () => {
        const workflow = {
            started_at: timestamp,
            closed_at: null,
            initiated_by: 'user:legacy',
            memo: { InitiatedBy: { data: 'legacy' } },
        };
        expect(validateApiResponse('ListWorkflowRunsResponse', { runs: [workflow] }).valid).toBe(true);
        expect(
            validateApiResponse('WorkflowRunWithDetails', {
                ...workflow,
                children: [{ started_at: timestamp, closed_at: null }],
            }).valid,
        ).toBe(true);
        expect(
            validateApiResponse('ListWorkflowInteractionsResponse', {
                workflow_id: 'workflow-1',
                run_id: 'run-1',
                interaction: {
                    type: 'conversation',
                    interaction: 'legacy',
                    interactive: true,
                    tool_names: [],
                    config: { model_options: { legacy_provider_field: true }, http_timeout: 30 },
                    agent_run_id: 'run-1',
                },
            }).valid,
        ).toBe(true);
    });

    it('accepts record key and value types in the generated activity catalog', () => {
        expect(
            validateApiResponse('ActivityCatalog', {
                activities: [
                    {
                        name: 'countByStatus',
                        title: 'Count By Status',
                        paramsType: 'CountByStatusParams',
                        params: [
                            {
                                name: 'counts',
                                optional: false,
                                type: {
                                    name: 'record',
                                    value: 'Record<string, number>',
                                    keyType: { name: 'string', value: 'string' },
                                    valueType: { name: 'number', value: 'number' },
                                },
                            },
                        ],
                    },
                ],
            }).valid,
        ).toBe(true);
    });

    it('accepts process context, history, and definitions stored in historical formats', () => {
        expect(
            validateApiResponse('ProcessContextResponse', {
                run_id: 'run-1',
                current_node: 'review',
                context: { invoice_id: 'inv-1' },
            }).valid,
        ).toBe(true);
        expect(
            validateApiResponse('ProcessHistoryResponse', {
                run_id: 'run-1',
                current_node: 'review',
                node_history: [{ node: 'review', entered_at: timestamp, status: 'running' }],
                node_history_ref: { path: 'history', latest_sequence: 1, count: 1 },
            }).valid,
        ).toBe(true);
        expect(
            validateApiResponse('ProcessDefinitionArray', [
                {
                    id: '64b000000000000000000008',
                    account: '64b000000000000000000003',
                    project: '64b000000000000000000004',
                    name: 'Legacy process',
                    status: 'draft',
                    version: 1,
                    definition: {
                        process: 'Legacy process',
                        initial: 'start',
                        context: {},
                        nodes: { start: { type: 'branch', branches: [{ to: 'done', condition: true }] } },
                    },
                    created_at: timestamp,
                    updated_at: timestamp,
                    created_by: 'user:legacy',
                    updated_by: 'user:legacy',
                },
            ]).valid,
        ).toBe(true);
    });
});
