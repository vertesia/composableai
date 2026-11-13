import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
    AgentRunEvaluation,
    AgentRunEvaluationRollup,
    AgentRunFeedbackEntry,
    AgentRunFeedbackPayload,
    AgentRunFeedbackResponse,
} from '../store/agent-run.js';
import {
    AgentEventType,
    TelemetryToolType,
    type ToolCallEvent,
    type TurnEvaluationEvent,
} from '../workflow-analytics.js';
import type {
    AgentRunEvaluationRollupSchema,
    AgentRunEvaluationSchema,
    AgentRunFeedbackEntrySchema,
    AgentRunFeedbackPayloadSchema,
    AgentRunFeedbackResponseSchema,
} from './agent-runs.js';
import { validateApiRequest, validateApiResponse } from './registry.js';

const turnEvaluation: TurnEvaluationEvent = {
    eventType: AgentEventType.TurnEvaluation,
    eventId: 'run-1:main:1:answer',
    timestamp: '2026-09-11T10:00:00.000Z',
    runId: 'wf-run-1',
    agentRunId: 'run-1',
    model: 'claude',
    environmentId: 'env-1',
    environmentType: 'vertexai',
    interactionId: 'sys:StudioAssistant',
    schemaVersion: 1,
    detectorVersion: 1,
    workstreamId: 'main',
    turnSeq: 1,
    terminalType: 'answer',
    startedAt: '2026-09-11T09:59:00.000Z',
    endedAt: '2026-09-11T10:00:00.000Z',
    durationMs: 60_000,
    activeMs: 50_000,
    askUserWaitMs: 0,
    approvalWaitMs: 10_000,
    toolCalls: 3,
    errorToolResults: 1,
    maxFailStreak: 1,
    identicalRetryCount: 0,
    unrecoveredTools: [],
    errorClasses: { schema: 1, platform: 0, config: 0, environment: 0, other: 0 },
    gatherCalls: 2,
    gatherRatio: 2 / 3,
    mutationAttempted: true,
    mutationSucceeded: true,
    rereadCount: 0,
    overheadCalls: 0,
    skillsLoaded: 0,
    interruptedToolCalls: 0,
    llmCalls: 4,
    promptTokens: 1000,
    completionTokens: 200,
    cachedTokens: 800,
    retryCompletionTokens: 50,
    approvalsRequested: 1,
    approvalsDenied: 0,
    stopRequests: 0,
    stallCorrectives: 0,
    stallTrips: 0,
    followupAfterAnswer: false,
    severity: 'none',
    flags: [],
    tools: [
        {
            seq: 1,
            toolUseId: 'tu-1',
            name: 'create_view',
            approvalClass: 'side_effecting',
            ok: false,
            errorClass: 'schema',
            sig: 'abcd1234',
            durationMs: 20,
        },
    ],
    toolsTruncated: 0,
};

describe('agent run evaluation API contracts', () => {
    it('derives the public types from the runtime schemas', () => {
        expectTypeOf<AgentRunFeedbackPayload>().toEqualTypeOf<
            import('zod').z.infer<typeof AgentRunFeedbackPayloadSchema>
        >();
        expectTypeOf<AgentRunFeedbackResponse>().toEqualTypeOf<
            import('zod').z.infer<typeof AgentRunFeedbackResponseSchema>
        >();
        expectTypeOf<AgentRunFeedbackEntry>().toEqualTypeOf<
            import('zod').z.infer<typeof AgentRunFeedbackEntrySchema>
        >();
        expectTypeOf<AgentRunEvaluationRollup>().toEqualTypeOf<
            import('zod').z.infer<typeof AgentRunEvaluationRollupSchema>
        >();
        expectTypeOf<AgentRunEvaluation>().toEqualTypeOf<import('zod').z.infer<typeof AgentRunEvaluationSchema>>();
    });

    it('publishes the LLM evaluation result through the renamed contract', () => {
        const result = {
            rev: 1,
            gate: 'always_on',
            sample_rate: 1,
            selected_probability: 1,
            outcome: 'evaluated',
            verdict: 'success',
            prompt_version: 'agent-run-evaluation/2',
            turns_evaluated: [1],
            evaluated_at: '2026-09-26T10:00:00.000Z',
        };
        expect(validateApiResponse('AgentRunLlmEvaluationResult', result).valid).toBe(true);
        expect(
            validateApiResponse('AgentRunEvaluation', {
                rev: 1,
                llm_evaluation: result,
                updated_at: result.evaluated_at,
                severity: 'none',
                flags: [],
                contradicted: false,
            }).valid,
        ).toBe(true);
    });

    it('accepts a turn_evaluation event through the ingest payload', () => {
        expect(validateApiRequest('IngestAgentEventsPayload', { events: [turnEvaluation] }).valid).toBe(true);
    });

    it('accepts a turn_evaluation event from a producer that predates the stall counters', () => {
        const { stallCorrectives: _c, stallTrips: _t, ...legacy } = turnEvaluation;
        expect(validateApiRequest('IngestAgentEventsPayload', { events: [legacy] }).valid).toBe(true);
    });

    it('accepts a version 2 turn_evaluation event with per-check outcomes and the configuration hash', () => {
        const v2: TurnEvaluationEvent = {
            ...turnEvaluation,
            schemaVersion: 2,
            detectorVersion: 4,
            errorClasses: { unknown_tool: 1, schema: 0, platform: 0, config: 0, environment: 0, other: 0 },
            cutOffResponses: 1,
            retriedLlmCalls: 0,
            peakContextRatio: 0.91,
            forcedCheckpoints: 0,
            agentConfigHash: '0123456789abcdef',
            severity: 'medium',
            flags: ['response_cut_off', 'unknown_tool', 'context_near_full'],
            checks: [
                { name: 'response_cut_off', state: 'fired', facts: { cut_off: 1 } },
                { name: 'unknown_tool', state: 'fired', toolUseId: 'tu-1', facts: { calls: 1 } },
                { name: 'checkpoint_forced', state: 'fine', facts: { checkpoints: 0 } },
                { name: 'llm_retried', state: 'not_checked' },
            ],
            tools: [{ ...turnEvaluation.tools[0], errorClass: 'unknown_tool' }],
        };
        expect(validateApiRequest('IngestAgentEventsPayload', { events: [v2] }).valid).toBe(true);
    });

    it('rejects a turn check in an unknown state', () => {
        const events = [{ ...turnEvaluation, checks: [{ name: 'unknown_tool', state: 'maybe' }] }];
        expect(validateApiRequest('IngestAgentEventsPayload', { events }).valid).toBe(false);
    });

    it('accepts a run_failure_streak event', () => {
        const event = {
            eventType: AgentEventType.RunFailureStreak,
            eventId: 'run-3:run_failure_streak',
            timestamp: turnEvaluation.timestamp,
            runId: 'wf-run-3',
            agentRunId: 'run-3',
            model: '',
            environmentId: '',
            environmentType: '',
            interactionId: 'Agent',
            source: 'schedule',
            sourceId: 'schedule-1',
            streakLength: 3,
            threshold: 3,
            failedRunIds: ['run-3', 'run-2', 'run-1'],
            ownerNotified: true,
        };
        expect(validateApiRequest('IngestAgentEventsPayload', { events: [event] }).valid).toBe(true);
        expect(
            validateApiRequest('IngestAgentEventsPayload', { events: [{ ...event, source: 'webhook' }] }).valid,
        ).toBe(false);
    });

    it('accepts the approval provenance of a tool_call event', () => {
        const toolCall = {
            eventType: AgentEventType.ToolCall,
            timestamp: turnEvaluation.timestamp,
            runId: 'wf-run-1',
            agentRunId: 'run-1',
            model: 'claude',
            environmentId: 'env-1',
            environmentType: 'vertexai',
            interactionId: 'sys:StudioAssistant',
            toolName: 'send_email',
            toolUseId: 'toolu-1',
            toolType: TelemetryToolType.Builtin,
            iteration: 1,
            success: false,
            durationMs: 0,
            errorType: 'ToolApprovalDenied',
            approvalOrigin: 'user_denied',
            approvalReviewerOutcome: 'allow',
            approvalReviewerRiskLevel: 'low',
            approvalReviewerRationale: 'The user asked for it.',
            approvalReviewerShadow: true,
        } satisfies ToolCallEvent;
        expect(validateApiRequest('IngestAgentEventsPayload', { events: [toolCall] }).valid).toBe(true);
        expect(
            validateApiRequest('IngestAgentEventsPayload', { events: [{ ...toolCall, approvalOrigin: 'magic' }] })
                .valid,
        ).toBe(false);
    });

    it('rejects a turn_evaluation event with an undeclared field', () => {
        const events = [{ ...turnEvaluation, verdict: 'success' }];
        expect(validateApiRequest('IngestAgentEventsPayload', { events }).valid).toBe(false);
    });

    it('accepts a feedback event and a LLM evaluation event', () => {
        const base = {
            timestamp: turnEvaluation.timestamp,
            runId: 'wf-run-1',
            agentRunId: 'run-1',
            model: '',
            environmentId: '',
            environmentType: '',
            interactionId: 'sys:StudioAssistant',
            deployment: { env: 'staging', group: 'staging', version: 'abc' },
        };
        const events = [
            {
                ...base,
                eventType: 'feedback',
                feedbackId: 'f1',
                rating: 'down',
                hasComment: false,
                messageScoped: false,
                replaced: false,
            },
            {
                ...base,
                eventType: 'turn_llm_evaluation',
                evaluationRev: 2,
                workstreamId: 'main',
                turnSeq: 1,
                gate: 'signal',
                sampleRate: 0,
                selectedProbability: 1,
                outcome: 'evaluated',
                verdict: 'failure',
                score: 0.2,
                promptVersion: 'v1',
            },
            {
                ...base,
                eventType: 'stall_breaker',
                action: 'trip',
                toolNames: ['fetch_document'],
                repeatCount: 4,
                stallMeasure: 4,
                allErrored: false,
                iteration: 7,
                interactive: true,
                workstreamId: 'main',
            },
        ];
        expect(validateApiRequest('IngestAgentEventsPayload', { events }).valid).toBe(true);
    });

    it('requires feedback_id and rejects the retired episode_seq field', () => {
        expect(validateApiRequest('AgentRunFeedbackPayload', { rating: 'up' }).valid).toBe(false);
        expect(validateApiRequest('AgentRunFeedbackPayload', { feedback_id: 'f1', rating: 'up' }).valid).toBe(true);
        expect(
            validateApiRequest('AgentRunFeedbackPayload', { feedback_id: 'f1', rating: 'up', episode_seq: 1 }).valid,
        ).toBe(false);
    });

    it('keeps the workflow rollup free of server-owned fields', () => {
        const rollup: AgentRunEvaluationRollup = {
            seq: 3,
            detector_version: 1,
            turns: 2,
            severity: 'medium',
            flags: ['unrecovered_tool'],
            worst_turn_seq: 2,
            last_terminal_type: 'answer',
            totals: {
                tool_calls: 5,
                error_tool_results: 2,
                unrecovered_tools: ['create_view'],
                llm_calls: 6,
                prompt_tokens: 100,
                completion_tokens: 20,
                cached_tokens: 0,
                retry_completion_tokens: 5,
                active_ms: 1000,
                ask_user_wait_ms: 0,
                approval_wait_ms: 0,
                followups: 0,
                approvals_requested: 0,
                approvals_denied: 0,
                stop_requests: 0,
                stall_trips: 0,
            },
            updated_at: turnEvaluation.timestamp,
        };
        expect(validateApiRequest('UpdateAgentRunStatusPayload', { evaluation_rollup: rollup }).valid).toBe(true);
        // Rollups stored or sent before the stall counter existed keep validating.
        const { stall_trips: _s, ...legacyTotals } = rollup.totals;
        expect(
            validateApiRequest('UpdateAgentRunStatusPayload', {
                evaluation_rollup: { ...rollup, totals: legacyTotals },
            }).valid,
        ).toBe(true);
        expect(
            validateApiResponse('AgentRunEvaluation', {
                rev: 1,
                rollup: { ...rollup, totals: legacyTotals },
                severity: 'medium',
                flags: ['unrecovered_tool'],
                contradicted: false,
                updated_at: turnEvaluation.timestamp,
            }).valid,
        ).toBe(true);
        expect(
            validateApiRequest('UpdateAgentRunStatusPayload', {
                evaluation_rollup: { ...rollup, feedback_counts: { up: 1, down: 0 } },
            }).valid,
        ).toBe(false);
    });

    it('validates the published evaluation summary', () => {
        const evaluation: AgentRunEvaluation = {
            rev: 2,
            feedback_counts: { up: 0, down: 1, last_rating: 'down', last_reason_code: 'wrong_result' },
            severity: 'none',
            flags: [],
            contradicted: true,
            contradiction_reasons: ['feedback_down_on_clean_run'],
            deployment_env: 'staging',
            updated_at: turnEvaluation.timestamp,
        };
        expect(validateApiResponse('AgentRunEvaluation', evaluation).valid).toBe(true);
        expect(validateApiRequest('ListAgentRunsQuery', { evaluation_severity: ['unrated', 'high'] }).valid).toBe(true);
    });
});

describe('agent evaluation policy contracts', () => {
    it.each(['disabled', 'opt_in', 'always_on'])('accepts project policy %s', (evaluation_policy) => {
        expect(validateApiRequest('UpdateProjectConfigurationPayload', { agent: { evaluation_policy } }).valid).toBe(
            true,
        );
    });
    it('rejects unsupported policies', () => {
        expect(
            validateApiRequest('UpdateProjectConfigurationPayload', { agent: { evaluation_policy: 'sample' } }).valid,
        ).toBe(false);
    });
    it.each([true, false])('accepts per-run evaluate=%s', (evaluate) => {
        expect(validateApiRequest('CreateAgentRunPayload', { interaction: 'sys:GeneralAgent', evaluate }).valid).toBe(
            true,
        );
        expect(
            validateApiRequest('RecordAgentRunPayload', {
                interaction: 'sys:GeneralAgent',
                workflow_id: 'workflow',
                first_workflow_run_id: 'run',
                evaluate,
            }).valid,
        ).toBe(true);
    });
    it('rejects a non-boolean evaluation request', () => {
        expect(
            validateApiRequest('CreateAgentRunPayload', { interaction: 'sys:GeneralAgent', evaluate: 'yes' }).valid,
        ).toBe(false);
    });
});

describe('agent evaluation request on conversation execution and responses', () => {
    const timestamp = '2026-09-28T10:00:00.000Z';
    const agentRun = {
        id: '64b000000000000000000002',
        account: '64b000000000000000000003',
        project: '64b000000000000000000004',
        run_kind: 'agent',
        run_type: 'autonomous',
        status: 'completed',
        started_by: 'user:test',
        started_at: timestamp,
        created_at: timestamp,
        updated_at: timestamp,
        interaction: 'sys:GeneralAgent',
        interactionRef: {
            id: 'sys:GeneralAgent',
            name: 'General Agent',
            endpoint: 'sys:GeneralAgent',
            status: 'code',
            version: 0,
            tags: [],
            updated_at: timestamp,
        },
    };

    it.each([true, false])('accepts evaluate=%s on the conversation execution payload', (evaluate) => {
        expect(
            validateApiRequest('AsyncConversationExecutionPayload', {
                type: 'conversation',
                interaction: 'sys:GeneralAgent',
                evaluate,
            }).valid,
        ).toBe(true);
    });

    it('rejects a non-boolean evaluate on the conversation execution payload', () => {
        expect(
            validateApiRequest('AsyncConversationExecutionPayload', {
                type: 'conversation',
                interaction: 'sys:GeneralAgent',
                evaluate: 'yes',
            }).valid,
        ).toBe(false);
    });

    it.each([true, false, undefined])('returns the stored evaluate=%s on agent run responses', (evaluate) => {
        const run = evaluate === undefined ? agentRun : { ...agentRun, evaluate };
        expect(validateApiResponse('AgentRun', run).valid).toBe(true);
    });

    it('rejects a non-boolean evaluate on agent run responses', () => {
        expect(validateApiResponse('AgentRun', { ...agentRun, evaluate: 'yes' }).valid).toBe(false);
    });
});

describe('agent run creation contract', () => {
    it('accepts the final verification opt-in as a boolean only', () => {
        const payload = { interaction: 'sys:GeneralAgent', final_verification: true };
        expect(validateApiRequest('CreateAgentRunPayload', payload).valid).toBe(true);
        expect(validateApiRequest('CreateAgentRunPayload', { ...payload, final_verification: 1 }).valid).toBe(false);
    });
});

describe('run budget allocation contract', () => {
    it.each([{ additional_tokens: 1000 }, { additional_usd: 0.25 }])('accepts one allowance: %j', (payload) => {
        expect(validateApiRequest('AllocateAgentRunBudgetPayload', payload).valid).toBe(true);
    });
    it.each([{}, { additional_tokens: 1, additional_usd: 1 }, { additional_usd: 0 }, { additional_tokens: -1 }])(
        'rejects ambiguous or invalid allowances: %j',
        (payload) => {
            expect(validateApiRequest('AllocateAgentRunBudgetPayload', payload).valid).toBe(false);
        },
    );
});

describe('agent run start idempotency_key', () => {
    const payloads = [
        ['CreateAgentRunPayload', { interaction: 'sys:GeneralAgent' }],
        ['CreateRunPayload', { interaction: 'sys:GeneralAgent' }],
        ['AsyncConversationExecutionPayload', { type: 'conversation', interaction: 'sys:GeneralAgent' }],
        ['AsyncExecutionPayload', { type: 'conversation', interaction: 'sys:GeneralAgent' }],
    ] as const;

    it.each(payloads)('%s accepts keys of 1 to 256 characters, or none', (name, base) => {
        for (const key of ['k', 'k'.repeat(256)]) {
            expect(validateApiRequest(name, { ...base, idempotency_key: key }).valid).toBe(true);
        }
        expect(validateApiRequest(name, base).valid).toBe(true);
    });

    it.each(payloads)('%s rejects an empty or 257-character key', (name, base) => {
        for (const key of ['', 'k'.repeat(257)]) {
            expect(validateApiRequest(name, { ...base, idempotency_key: key }).valid).toBe(false);
        }
    });
});

describe('agent run internals config', () => {
    const internals = {
        id: '6a0000000000000000000001',
        status: 'running',
        started_at: '2026-11-01T00:00:00.000Z',
        started_by: 'user:1',
        created_at: '2026-11-01T00:00:00.000Z',
        updated_at: '2026-11-01T00:00:00.000Z',
    };

    it('accepts the process run config a process run stores', () => {
        const result = validateApiResponse('AgentRunInternals', {
            ...internals,
            run_kind: 'process',
            run_type: 'supervised',
            config: { environment: 'env-1', model: 'model-1', user_message: 'Review the contract' },
        });
        expect(result.valid ? [] : result.errors).toEqual([]);
    });

    it('accepts the execution config an agent run stores', () => {
        const result = validateApiResponse('AgentRunInternals', {
            ...internals,
            run_kind: 'agent',
            run_type: 'autonomous',
            config: { environment: 'env-1', model: 'model-1' },
        });
        expect(result.valid ? [] : result.errors).toEqual([]);
    });

    it('still rejects a config key that neither shape declares', () => {
        expect(validateApiResponse('AgentRunInternals', { ...internals, config: { not_a_field: true } }).valid).toBe(
            false,
        );
    });
});
