import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
    AgentRunEvaluation,
    AgentRunEvaluationRollup,
    AgentRunFeedbackEntry,
    AgentRunFeedbackPayload,
    AgentRunFeedbackResponse,
} from '../store/agent-run.js';
import { AgentEventType, type TurnEvaluationEvent } from '../workflow-analytics.js';
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

    it('accepts a turn_evaluation event through the ingest payload', () => {
        expect(validateApiRequest('IngestAgentEventsPayload', { events: [turnEvaluation] }).valid).toBe(true);
    });

    it('rejects a turn_evaluation event with an undeclared field', () => {
        const events = [{ ...turnEvaluation, verdict: 'success' }];
        expect(validateApiRequest('IngestAgentEventsPayload', { events }).valid).toBe(false);
    });

    it('accepts a feedback event and a judgement event', () => {
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
                eventType: 'turn_judgement',
                evaluationRev: 2,
                workstreamId: 'main',
                turnSeq: 1,
                gate: 'signal',
                sampleRate: 0,
                selectedProbability: 1,
                outcome: 'judged',
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
