import { describe, expect, it } from 'vitest';
import { AgentEventType, LlmCallType } from '../workflow-analytics.js';
import { AgentEventSchema } from './agent-runs.js';

describe('AgentEventSchema', () => {
    it('round-trips shadow skill-ranking events', () => {
        const event = {
            eventType: AgentEventType.ShadowSkillRanking,
            timestamp: '2026-08-06T00:00:00.000Z',
            runId: 'run-1',
            agentRunId: 'agent-run-1',
            model: 'model-1',
            environmentId: 'environment-1',
            environmentType: 'test',
            interactionId: 'interaction-1',
            callType: LlmCallType.ResumeUser,
            iteration: 4,
            attemptNumber: 1,
            scorerVersion: 2,
            userMessageTokenCount: 3,
            scope: 'universe',
            rankings: [{ skill: 'learn_data_analysis', score: 24, active: true }],
        } as const;

        expect(AgentEventSchema.parse(event)).toEqual(event);
    });

    it('continues to reject unknown event types', () => {
        expect(() => AgentEventSchema.parse({ eventType: 'unknown' })).toThrow();
    });

    it('rejects shadow rankings above the telemetry cap', () => {
        const event = {
            eventType: AgentEventType.ShadowSkillRanking,
            timestamp: '2026-08-06T00:00:00.000Z',
            runId: 'run-1',
            model: 'model-1',
            environmentId: 'environment-1',
            environmentType: 'test',
            interactionId: 'interaction-1',
            callType: LlmCallType.Start,
            iteration: 0,
            attemptNumber: 1,
            scorerVersion: 2,
            userMessageTokenCount: 1,
            scope: 'universe',
            rankings: Array.from({ length: 21 }, (_, index) => ({
                skill: `learn_skill_${index}`,
                score: 0,
                active: false,
            })),
        } as const;

        expect(() => AgentEventSchema.parse(event)).toThrow();
    });
});
