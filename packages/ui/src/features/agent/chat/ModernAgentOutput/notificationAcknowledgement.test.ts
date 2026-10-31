import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import {
    findLatestAnswerMessage,
    getAgentMessageAcknowledgement,
    getRequestInputOccurrence,
    hasAgentRunEnded,
    isAcknowledgeableAgentMessage,
} from './notificationAcknowledgement';

function message(type: AgentMessageType, timestamp: number, extra: Partial<AgentMessage> = {}): AgentMessage {
    return {
        type,
        timestamp,
        message: `message ${timestamp}`,
        workflow_run_id: 'wf-run',
        workstream_id: 'main',
        ...extra,
    } as AgentMessage;
}

describe('getRequestInputOccurrence', () => {
    it('names the request by run and request id', () => {
        const request = message(AgentMessageType.REQUEST_INPUT, 1, { details: { request_id: 'req-1' } });
        expect(getRequestInputOccurrence('run-1', request)).toEqual({ type: 'agent_request', id: 'run-1:req-1' });
    });

    it('needs a run id, a request id and a REQUEST_INPUT message', () => {
        const request = message(AgentMessageType.REQUEST_INPUT, 1, { details: { request_id: 'req-1' } });
        expect(getRequestInputOccurrence(undefined, request)).toBeUndefined();
        expect(getRequestInputOccurrence('run-1', message(AgentMessageType.REQUEST_INPUT, 1))).toBeUndefined();
        expect(
            getRequestInputOccurrence('run-1', message(AgentMessageType.ANSWER, 1, { details: { request_id: 'x' } })),
        ).toBeUndefined();
    });
});

describe('findLatestAnswerMessage', () => {
    it('returns the last non-empty main-workstream answer', () => {
        const answer = message(AgentMessageType.ANSWER, 2);
        const messages = [
            message(AgentMessageType.ANSWER, 1),
            answer,
            message(AgentMessageType.ANSWER, 3, { workstream_id: 'child' }),
            message(AgentMessageType.COMPLETE, 4, { message: '' }),
            message(AgentMessageType.THOUGHT, 5),
        ];
        expect(findLatestAnswerMessage(messages)).toBe(answer);
    });

    it('returns undefined without answers', () => {
        expect(findLatestAnswerMessage([message(AgentMessageType.THOUGHT, 1)])).toBeUndefined();
    });
});

describe('hasAgentRunEnded', () => {
    it('is true when the latest state message is COMPLETE or TERMINATED', () => {
        expect(hasAgentRunEnded([message(AgentMessageType.ANSWER, 1), message(AgentMessageType.COMPLETE, 2)])).toBe(
            true,
        );
        expect(hasAgentRunEnded([message(AgentMessageType.TERMINATED, 1)])).toBe(true);
    });

    it('is false for an idle interactive run or a new user turn', () => {
        expect(hasAgentRunEnded([message(AgentMessageType.COMPLETE, 1), message(AgentMessageType.IDLE, 2)])).toBe(
            false,
        );
        expect(hasAgentRunEnded([message(AgentMessageType.COMPLETE, 1), message(AgentMessageType.QUESTION, 2)])).toBe(
            false,
        );
        expect(hasAgentRunEnded([])).toBe(false);
    });

    it('ignores child workstreams', () => {
        expect(
            hasAgentRunEnded([
                message(AgentMessageType.IDLE, 1),
                message(AgentMessageType.COMPLETE, 2, { workstream_id: 'child' }),
            ]),
        ).toBe(false);
    });
});

describe('getAgentMessageAcknowledgement', () => {
    const answer = message(AgentMessageType.ANSWER, 10);
    const base = { agentRunId: 'run-1', latestAnswer: answer, isRunCompleted: false, isAgentWorking: false };

    it('acknowledges a request', () => {
        const request = message(AgentMessageType.REQUEST_INPUT, 5, { details: { request_id: 'req-1' } });
        expect(getAgentMessageAcknowledgement(request, { ...base, isAgentWorking: true })).toEqual([
            { type: 'agent_request', id: 'run-1:req-1' },
        ]);
    });

    it('acknowledges the turn when an interactive run waits for the user', () => {
        expect(getAgentMessageAcknowledgement(answer, base)).toEqual([{ type: 'agent_turn', id: 'run-1' }]);
    });

    it('matches a copied latest answer', () => {
        expect(getAgentMessageAcknowledgement({ ...answer }, base)).toEqual([{ type: 'agent_turn', id: 'run-1' }]);
    });

    it('acknowledges the run end and the turns when the run ended', () => {
        expect(getAgentMessageAcknowledgement(answer, { ...base, isRunCompleted: true })).toEqual([
            { type: 'agent_run_end', id: 'run-1' },
            { type: 'agent_turn', id: 'run-1' },
        ]);
    });

    it('acknowledges nothing while the agent works, for older answers, or without a run', () => {
        expect(getAgentMessageAcknowledgement(answer, { ...base, isAgentWorking: true })).toBeUndefined();
        expect(getAgentMessageAcknowledgement(message(AgentMessageType.ANSWER, 1), base)).toBeUndefined();
        expect(getAgentMessageAcknowledgement(answer, { ...base, agentRunId: undefined })).toBeUndefined();
    });
});

describe('isAcknowledgeableAgentMessage', () => {
    it('covers requests and answers only', () => {
        expect(isAcknowledgeableAgentMessage(message(AgentMessageType.REQUEST_INPUT, 1))).toBe(true);
        expect(isAcknowledgeableAgentMessage(message(AgentMessageType.ANSWER, 1))).toBe(true);
        expect(isAcknowledgeableAgentMessage(message(AgentMessageType.COMPLETE, 1))).toBe(true);
        expect(isAcknowledgeableAgentMessage(message(AgentMessageType.THOUGHT, 1))).toBe(false);
    });
});
