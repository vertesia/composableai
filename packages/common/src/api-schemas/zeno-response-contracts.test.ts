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
        format_version: 1,
        process: 'Process',
        initial: 'start',
        context: { schema: {}, initial: {} },
        nodes: { start: { type: 'final' } },
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
    it('accepts conversation metadata and enrichment controls when creating an agent run', () => {
        expect(
            validateApiRequest('CreateAgentRunPayload', {
                interaction: 'sys:generic_question',
                title: 'Manual title',
                topic: 'Manual topic',
                generate_topic: false,
                generate_lessons: false,
            }).valid,
        ).toBe(true);
        expect(
            validateApiRequest('RecordAgentRunPayload', {
                interaction: 'sys:generic_question',
                workflow_id: 'workflow-1',
                first_workflow_run_id: 'run-1',
                title: 'Manual title',
                topic: 'Manual topic',
                generate_topic: false,
                generate_lessons: false,
            }).valid,
        ).toBe(true);
    });

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

    it('accepts runtime model and effort status updates', () => {
        expect(
            validateApiRequest('UpdateAgentRunStatusPayload', {
                model: 'gpt-5.6-sol',
                effort: 'xhigh',
            }).valid,
        ).toBe(true);
        expect(validateApiRequest('UpdateAgentRunStatusPayload', { effort: null }).valid).toBe(true);
        expect(validateApiRequest('UpdateAgentRunStatusPayload', { effort: 'unbounded' }).valid).toBe(false);
    });

    it('accepts normalized autonomous runs and projected refs', () => {
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

    it('uses the current compact message contract for update responses', () => {
        const response = { messages: [{ t: 2, d: { files: ['legacy-file-id'] } }] };
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
        const { sensitivity: _sensitivity, compartments: _compartments, ...contentObjectItem } = contentObject;
        expect(validateApiResponse('ContentObjectItemApiResponseArray', [contentObjectItem]).valid).toBe(true);
        expect(validateApiResponse('ProjectedContentObjectApiResponse', { id: contentObject.id, score: 1 }).valid).toBe(
            true,
        );
        expect(validateApiResponse('ProjectedContentObjectApiResponse', { id: contentObject.id, bogus: 1 }).valid).toBe(
            false,
        );
        expect(
            validateApiResponse('ObjectSearchResponse', {
                results: [{ id: contentObject.id, score: 1 }],
                facets: { total: 1 },
            }).valid,
        ).toBe(true);
    });

    it('accepts display metadata on child-workflow steps', () => {
        expect(
            validateApiResponse('DSLWorkflowDefinitionResponse', {
                id: 'workflow-1',
                name: 'Parent workflow',
                edit_revision: 1,
                created_by: 'user-1',
                updated_by: 'user-1',
                created_at: timestamp,
                updated_at: timestamp,
                vars: {},
                spec_format: 'steps',
                steps: [
                    {
                        type: 'workflow',
                        name: 'childWorkflow',
                        title: 'Review documents',
                        description: 'Runs the review child workflow',
                    },
                ],
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
        // `total` is reserved for the match count: buckets belong under the facet's own name. The
        // server rejects a facet named `total` with a 400, so an array can never reach this field.
        expect(validateApiResponse('ComputedFacetResponse', { total: [{ _id: 'ready', count: 3 }] }).valid).toBe(false);
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

    it('accepts workflow memo, children, and interaction snapshots', () => {
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
                    config: {
                        environment: '64b000000000000000000005',
                        model: 'model',
                    },
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

    it('accepts process context, history, and current process definitions', () => {
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
                    edit_revision: 1,
                    name: 'Legacy process',
                    status: 'draft',
                    version: 1,
                    definition: {
                        format_version: 1,
                        process: 'Process',
                        initial: 'start',
                        context: { schema: {}, initial: {} },
                        nodes: { start: { type: 'final' } },
                    },
                    created_at: timestamp,
                    updated_at: timestamp,
                    created_by: 'user:legacy',
                    updated_by: 'user:legacy',
                },
            ]).valid,
        ).toBe(true);
    });

    it('publishes agent-node launch and execution policy', () => {
        expect(
            validateApiRequest('CreateProcessDefinitionPayload', {
                name: 'App development process',
                definition: {
                    format_version: 1,
                    process: 'app_development',
                    initial: 'implement',
                    context: { schema: {}, initial: {} },
                    nodes: {
                        implement: {
                            type: 'agent',
                            interaction: 'sys:AppDeveloper',
                            inherit_context: false,
                            initial_skills: ['app_quick_fix'],
                            excluded_tools: ['learn_app_development'],
                            agent_policy: {
                                phases: [
                                    {
                                        id: 'saved',
                                        tools: ['app_workspace_save'],
                                        tool_input_contains: [{ field: 'mode', contains: 'commit' }],
                                        recovery_prompt: 'Save before finishing.',
                                    },
                                ],
                                phase_resets: [{ tools: ['app_workspace_edit'], to_phase: 'saved' }],
                                defer_result_schema_until_complete: true,
                                completion_prompt: 'Return the structured result now.',
                            },
                        },
                    },
                },
            }).valid,
        ).toBe(true);
    });
});
