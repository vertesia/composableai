import { describe, expect, it } from 'vitest';
import type { AsyncConversationExecutionPayload } from '../interaction.js';
import {
    AsyncCompletionOptionsSchema,
    AsyncConversationExecutionPayloadSchema,
    CanonicalAsyncCompletionResultSchema,
    CanonicalContinuationStateSchema,
    CanonicalConversationHeadScopeQuerySchema,
    CanonicalConversationHeadScopeSchema,
    CanonicalPendingApplicationToolCallSchema,
    ComputeRunFacetPayloadSchema,
    ComputeRunFacetsResponseSchema,
    ConversationStateSchema,
    ExecutionRunRefSchema,
    FindRunResultSchema,
    InCodeInteractionSchema,
    InteractionCreatePayloadSchema,
    InteractionPromptSegmentInputSchema,
    InteractionSchema,
    InteractionUpdatePayloadSchema,
    PromptSegmentDefSchema,
    ResolvedCatalogInteractionSchema,
    RunClonePayloadSchema,
} from './interaction.js';
import { validateApiRequest } from './registry.js';

describe('conversation state contract', () => {
    it('publishes the tool catalog storage scope used to resolve tool references', () => {
        expect(ConversationStateSchema.shape.tool_catalog_storage_id.safeParse('process-run-1').success).toBe(true);
    });

    it('keeps canonical async authority outside the strict legacy state', () => {
        const state = {
            run: { id: 'run-1', account: 'account-1', project: 'project-1' },
            environment: 'environment-1',
            options: { model: 'model-1' },
            output: [],
            ancestors: [],
        };
        const canonicalState = {
            head: { conversation_id: 'conversation-1', revision: 4 },
            scope: 'workstream:reviewer',
        };
        const result = { state, canonical_state: canonicalState };

        expect(CanonicalContinuationStateSchema.parse(canonicalState)).toEqual(canonicalState);
        expect(CanonicalAsyncCompletionResultSchema.parse(result)).toEqual(result);
        expect(validateApiRequest('CanonicalAsyncCompletionResult', result).valid).toBe(true);
        expect(ConversationStateSchema.safeParse({ ...state, canonical_state: canonicalState }).success).toBe(false);
    });

    it('carries an exact output receipt only for the versioned private async opt-in', () => {
        const outputReceipt = {
            id: 'response:1',
            conversation_id: 'conversation-1',
            base_revision: 3,
            result_revision: 4,
            recorded_at: '2026-10-01T00:00:00.000Z',
            accepted_turn_ids: ['turn-1'],
            accepted_generation_ids: ['generation-1'],
        };
        const canonicalState = CanonicalContinuationStateSchema.parse({
            head: { conversation_id: 'conversation-1', revision: 5 },
            scope: 'root',
            output_receipt: outputReceipt,
        });
        expect(canonicalState.output_receipt).toEqual(outputReceipt);
        expect(
            AsyncCompletionOptionsSchema.parse({
                run_id: 'workflow-run-1',
                activity_id: 'activity-1',
                canonical_output_reference: 'conversation_output_receipt_v1',
            }).canonical_output_reference,
        ).toBe('conversation_output_receipt_v1');
        expect(
            AsyncCompletionOptionsSchema.safeParse({
                run_id: 'workflow-run-1',
                activity_id: 'activity-1',
                canonical_output_reference: 'legacy-content',
            }).success,
        ).toBe(false);
    });

    it('uses one strict root-or-workstream scope contract for carrier and query', () => {
        expect(CanonicalConversationHeadScopeSchema.parse('root')).toBe('root');
        expect(CanonicalConversationHeadScopeSchema.parse('workstream:reviewer_2')).toBe('workstream:reviewer_2');
        expect(
            CanonicalConversationHeadScopeQuerySchema.parse({ conversation_scope: 'workstream:reviewer_2' }),
        ).toEqual({ conversation_scope: 'workstream:reviewer_2' });
        expect(validateApiRequest('CanonicalConversationHeadScopeQuery', { conversation_scope: 'root' }).valid).toBe(
            true,
        );
        expect(CanonicalConversationHeadScopeSchema.safeParse('workstream:../../other').success).toBe(false);
        expect(
            CanonicalConversationHeadScopeQuerySchema.safeParse({ conversation_scope: 'root', extra: true }).success,
        ).toBe(false);
    });

    it('carries ordered application call identities with matching exact sources', () => {
        const source = {
            conversation: { conversation_id: 'conversation-1', revision: 4 },
            turn_id: 'turn-1',
            block_id: 'block-1',
            call_id: 'call-1',
            call_fingerprint: `sha256:${'a'.repeat(64)}`,
        };
        const pending = {
            source,
            call: { call_id: 'call-1', tool_name: 'write_document', executor: 'application' },
        };

        expect(CanonicalPendingApplicationToolCallSchema.parse(pending)).toEqual(pending);
        expect(
            CanonicalContinuationStateSchema.parse({
                head: source.conversation,
                scope: 'root',
                pending_tool_calls: [pending],
            }).pending_tool_calls,
        ).toEqual([pending]);
        expect(
            CanonicalPendingApplicationToolCallSchema.safeParse({
                ...pending,
                call: { ...pending.call, call_id: 'other-call' },
            }).success,
        ).toBe(false);
        expect(
            CanonicalPendingApplicationToolCallSchema.safeParse({
                ...pending,
                call: { ...pending.call, executor: 'provider' },
            }).success,
        ).toBe(false);
    });
});

describe('in-code interaction contract', () => {
    it('retains prompt schemas when resolving a catalog interaction', () => {
        const interaction = InCodeInteractionSchema.parse({
            type: 'sys',
            id: 'sys:GeneralAgent',
            name: 'GeneralAgent',
            title: 'General Agent',
            tags: ['agent'],
            agent_runner_options: { is_agent: true, request_template: '{{user_prompt}}' },
            prompts: [
                {
                    role: 'user',
                    content: '{{user_prompt}}',
                    content_type: 'handlebars',
                    schema: {
                        type: 'object',
                        properties: { user_prompt: { type: 'string', editor: 'textarea' } },
                    },
                },
            ],
        });

        expect(interaction.prompts[0]?.schema).toMatchObject({
            properties: { user_prompt: { type: 'string' } },
        });
    });

    it('requires normalized title and tags only on the resolved response', () => {
        const authoringShape = {
            type: 'sys',
            id: 'sys:Untitled',
            name: 'Untitled',
            prompts: [],
        };

        expect(InCodeInteractionSchema.safeParse(authoringShape).success).toBe(true);
        expect(ResolvedCatalogInteractionSchema.safeParse(authoringShape).success).toBe(false);
        expect(
            ResolvedCatalogInteractionSchema.safeParse({ ...authoringShape, title: 'Untitled', tags: [] }).success,
        ).toBe(true);
    });
});

describe('AsyncConversationExecutionPayload contract', () => {
    it('accepts caller-provided metadata and enrichment controls', () => {
        const payload: AsyncConversationExecutionPayload = {
            type: 'conversation',
            interaction: 'sys:AppTester',
            title: 'Manual title',
            topic: 'Manual topic',
            generate_topic: false,
            generate_lessons: false,
        };

        expect(AsyncConversationExecutionPayloadSchema.parse(payload)).toMatchObject(payload);
    });

    it('retains an immutable app-version execution target', () => {
        const payload: AsyncConversationExecutionPayload = {
            type: 'conversation',
            interaction: 'sys:AppTester',
            app_version: '20260804T022611971Z',
        };

        expect(AsyncConversationExecutionPayloadSchema.parse(payload)).toMatchObject({
            app_version: '20260804T022611971Z',
        });
    });

    it('accepts Process-authored agent execution policy', () => {
        const payload: AsyncConversationExecutionPayload = {
            type: 'conversation',
            interaction: 'sys:AppDeveloper',
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
                action_phase_count: 1,
                action_phase_max_tokens: 4_096,
                completion_prompt: 'Return the structured result now.',
            },
        };

        expect(AsyncConversationExecutionPayloadSchema.parse(payload)).toMatchObject(payload);
    });

    it('accepts the final verification opt-in as a boolean only', () => {
        const payload = { type: 'conversation', interaction: 'sys:GeneralAgent', final_verification: true };
        expect(validateApiRequest('AsyncConversationExecutionPayload', payload).valid).toBe(true);
        expect(
            validateApiRequest('AsyncConversationExecutionPayload', { ...payload, final_verification: 'yes' }).valid,
        ).toBe(false);
    });

    it('rejects a non-string app-version target', () => {
        expect(() =>
            AsyncConversationExecutionPayloadSchema.parse({
                type: 'conversation',
                interaction: 'sys:AppTester',
                app_version: 42,
            }),
        ).toThrow();
    });
});

describe('run facet contracts', () => {
    const facets = [
        { name: 'environments', field: 'environment' },
        { name: 'interactions', field: 'interaction' },
        { name: 'models', field: 'modelId' },
        { name: 'statuses', field: 'status' },
        { name: 'finish_reason', field: 'finish_reason' },
    ];

    it('accepts exactly the supported run facet pairs', () => {
        expect(ComputeRunFacetPayloadSchema.parse({ facets })).toEqual({ facets });
    });

    it.each(['tags', 'created_by', 'start', 'end'])('rejects the removed %s facet', (field) => {
        expect(ComputeRunFacetPayloadSchema.safeParse({ facets: [{ name: field, field }] }).success).toBe(false);
    });

    it('rejects mismatched and additional facet names', () => {
        expect(ComputeRunFacetPayloadSchema.safeParse({ facets: [{ name: 'models', field: 'status' }] }).success).toBe(
            false,
        );
        expect(ComputeRunFacetPayloadSchema.safeParse({ facets: [{ name: 'custom', field: 'modelId' }] }).success).toBe(
            false,
        );
    });

    it('keeps removed facet fields available as query filters', () => {
        const query = {
            tags: ['visible'],
            created_by: 'user:123',
            start: '2026-08-01T00:00:00.000Z',
            end: '2026-08-02T00:00:00.000Z',
        };

        expect(ComputeRunFacetPayloadSchema.parse({ facets: [], query })).toEqual({ facets: [], query });
    });

    it('rejects removed and custom response facets', () => {
        expect(ComputeRunFacetsResponseSchema.safeParse({ tags: [] }).success).toBe(false);
        expect(ComputeRunFacetsResponseSchema.safeParse({ custom: [] }).success).toBe(false);
    });
});

describe('run response contracts', () => {
    it('retains an environment ID when a run references a deleted environment', () => {
        expect(ExecutionRunRefSchema.shape.environment.parse('env-deleted')).toBe('env-deleted');
        expect(ExecutionRunRefSchema.shape.environment.parse(null)).toBeNull();
    });

    it('models the arbitrary stored-field projection returned by /runs/find', () => {
        expect(
            FindRunResultSchema.parse({
                id: 'run-1',
                environment: 'env-1',
                account: 'account-1',
                project: 'project-1',
                interaction: 'interaction-1',
                result: [],
                parameters: { query: 'test' },
            }),
        ).toMatchObject({ environment: 'env-1', account: 'account-1', project: 'project-1' });
    });

    it('does not publish run persistence-only fields', () => {
        expect(() => FindRunResultSchema.parse({ interaction_code: 'sys:Example' })).toThrow();
        expect(() => FindRunResultSchema.parse({ tmp_prompt: [] })).toThrow();
    });

    it('models enriched supported run facet buckets', () => {
        expect(
            ComputeRunFacetsResponseSchema.parse({
                environments: [{ _id: 'env-1', count: 2, name: 'Default' }],
                interactions: [{ _id: 'interaction-1', count: 1, name: 'Example', status: 'published', version: 3 }],
                models: [{ _id: 'gpt', count: 2 }],
                total: 2,
            }),
        ).toMatchObject({ total: 2 });
    });
});

describe('interaction contracts', () => {
    const populatedPrompt = {
        role: 'user',
        content: 'Hello',
        content_type: 'text',
        id: 'prompt-1',
        name: 'Greeting',
        status: 'draft',
        version: 1,
        project: 'project-1',
        created_by: 'user-1',
        updated_by: 'user-1',
        created_at: '2026-08-20T00:00:00.000Z',
        updated_at: '2026-08-20T00:00:00.000Z',
    };

    it('accepts the media-result storage setting on interaction payloads and responses', () => {
        expect(InteractionSchema.shape.store_media_results.parse(true)).toBe(true);
        expect(InteractionCreatePayloadSchema.shape.store_media_results.parse(false)).toBe(false);
        expect(InteractionUpdatePayloadSchema.shape.store_media_results.parse(true)).toBe(true);
    });

    it('keeps legacy populated prompts valid in interaction write payloads', () => {
        const segment = { type: 'template', template: populatedPrompt };

        expect(InteractionPromptSegmentInputSchema.safeParse(segment).success).toBe(true);
        expect(
            InteractionPromptSegmentInputSchema.safeParse({
                ...segment,
                template: { ...populatedPrompt, edit_revision: 3 },
            }).success,
        ).toBe(true);
    });

    it('still requires edit revisions on populated prompts returned by the API', () => {
        const segment = { type: 'template', template: populatedPrompt };

        expect(PromptSegmentDefSchema.safeParse(segment).success).toBe(false);
        expect(
            PromptSegmentDefSchema.safeParse({
                ...segment,
                template: { ...populatedPrompt, edit_revision: 3 },
            }).success,
        ).toBe(true);
    });
});

describe('user message payload contract', () => {
    const base = {
        run: { id: 'run-1', account: 'acc-1', project: 'proj-1' },
        environment: 'env-1',
        options: { model: 'model-1' },
        tools: [],
        message: 'Search the other collection instead.',
    };

    it('accepts tool results owed to the model alongside the message', () => {
        // A stop or an approval denial can leave results undelivered. They have to travel with
        // the message that resumes the conversation: the payload is strict, so before `results`
        // existed here the server rejected them and the work was silently dropped.
        const result = validateApiRequest('UserMessagePayload', {
            ...base,
            results: [{ tool_use_id: 'search-1', content: 'found 3 docs', is_error: false }],
        });

        expect(result.valid).toBe(true);
    });

    it('still accepts a message with no owed results', () => {
        expect(validateApiRequest('UserMessagePayload', base).valid).toBe(true);
    });

    it('stays closed to undeclared fields', () => {
        expect(validateApiRequest('UserMessagePayload', { ...base, unsupported: true }).valid).toBe(false);
    });
});

describe('inference workflow attribution', () => {
    it('keeps required clone workflow identifiers free of execution deprecation metadata', () => {
        const workflow = RunClonePayloadSchema.shape.workflow.shape;
        expect(workflow.run_id.meta()?.deprecated).toBeUndefined();
        expect(workflow.workflow_id.meta()?.deprecated).toBeUndefined();
    });
    it('accepts root agent attribution on execution and clone requests', () => {
        const workflow = { run_id: 'child-run', workflow_id: 'workstream:parent:child', agent_run_id: 'root-agent' };
        expect(validateApiRequest('ExecutionRunWorkflow', workflow).valid).toBe(true);
        expect(validateApiRequest('RunClonePayload', { source_run_id: 'source', workflow }).valid).toBe(true);
        expect(
            validateApiRequest('ExecutionRunWorkflow', { run_id: 'legacy', workflow_id: 'AgentRun:legacy' }).valid,
        ).toBe(true);
    });
});

describe('background inference telemetry contract', () => {
    it('accepts the background call type in the generated runtime contract', () => {
        expect(validateApiRequest('LlmCallType', 'background').valid).toBe(true);
    });
});
