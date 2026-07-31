import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import {
    getAnsweredRequestInputKeys,
    getAnsweredToolApprovalRequestInputKeys,
    getPendingRequestInputMessage,
    getRequestInputMessageKey,
    getRequestInputResponseIdFromMetadata,
    getRequestInputResponseMetadata,
    getToolApprovalResponseMetadata,
} from './requestInputMessages';

const APPROVAL_KEY = 'create_interaction:name:JDE AR Payment Processing Agent';

function makeApprovalRequest(): AgentMessage {
    return {
        timestamp: 1,
        type: AgentMessageType.REQUEST_INPUT,
        message: 'Approve Create a new draft interaction: JDE AR Payment Processing Agent?',
        workstream_id: 'main',
        details: {
            tool_approval: { tool_name: 'create_interaction', approval_key: APPROVAL_KEY },
            ux: { options: [{ id: 'allow_once' }, { id: 'allow_for_run' }, { id: 'deny' }] },
        },
    } as unknown as AgentMessage;
}

function makeUserAnswer(message: string, metadata?: Record<string, unknown>): AgentMessage {
    return {
        timestamp: 2,
        type: AgentMessageType.QUESTION,
        message,
        workstream_id: 'main',
        details: metadata ? { metadata } : undefined,
    } as unknown as AgentMessage;
}

describe('getToolApprovalResponseMetadata', () => {
    it('builds structured response metadata for approval options', () => {
        expect(getToolApprovalResponseMetadata(makeApprovalRequest(), 'allow_for_run')).toEqual({
            tool_approval_response: { decision: 'allow_for_run', approval_key: APPROVAL_KEY },
        });
    });

    it('returns undefined for prompts that are not tool approvals', () => {
        const plainPrompt = {
            timestamp: 1,
            type: AgentMessageType.REQUEST_INPUT,
            message: 'Which environment?',
            workstream_id: 'main',
            details: { ux: { options: [{ id: 'staging' }, { id: 'production' }] } },
        } as unknown as AgentMessage;
        expect(getToolApprovalResponseMetadata(plainPrompt, 'staging')).toBeUndefined();
    });

    it('returns undefined for unknown option ids', () => {
        expect(getToolApprovalResponseMetadata(makeApprovalRequest(), 'staging')).toBeUndefined();
    });
});

describe('getAnsweredToolApprovalRequestInputKeys', () => {
    it('treats a bare option answer as answered', () => {
        const request = makeApprovalRequest();
        const answer = makeUserAnswer('allow_for_run');
        const answered = getAnsweredToolApprovalRequestInputKeys([request, answer]);
        expect(answered.has(getRequestInputMessageKey(request))).toBe(true);
    });

    it('treats a metadata-carrying answer as answered regardless of its text', () => {
        const request = makeApprovalRequest();
        const answer = makeUserAnswer('Allow this action for this run\n\nUploaded artifacts:\n[a.png](artifact:a)', {
            tool_approval_response: { decision: 'allow_for_run', approval_key: APPROVAL_KEY },
        });
        const answered = getAnsweredToolApprovalRequestInputKeys([request, answer]);
        expect(answered.has(getRequestInputMessageKey(request))).toBe(true);
    });

    it('does not treat unrelated prose as an approval answer', () => {
        const request = makeApprovalRequest();
        const answer = makeUserAnswer('please proceed\n\nUploaded artifacts:\n[a.png](artifact:a)');
        const answered = getAnsweredToolApprovalRequestInputKeys([request, answer]);
        expect(answered.size).toBe(0);
    });
});

describe('request input correlation', () => {
    it('correlates a persisted response to the matching request id', () => {
        const firstRequest = {
            ...makeApprovalRequest(),
            details: { request_id: 'request-1', ux: { options: [{ id: 'red', label: 'Red' }] } },
        };
        const secondRequest = {
            ...makeApprovalRequest(),
            timestamp: 2,
            details: { request_id: 'request-2', ux: { options: [{ id: 'blue', label: 'Blue' }] } },
        };
        const answer = {
            ...makeUserAnswer('red'),
            timestamp: 3,
            details: { request_input_response: { request_id: 'request-1' } },
        };

        const answered = getAnsweredRequestInputKeys([firstRequest, secondRequest, answer]);

        expect(answered.has(getRequestInputMessageKey(firstRequest))).toBe(true);
        expect(answered.has(getRequestInputMessageKey(secondRequest))).toBe(false);
        expect(getPendingRequestInputMessage([firstRequest, secondRequest, answer])).toBe(secondRequest);
    });

    it('adds the request id without discarding existing response metadata', () => {
        const request = {
            ...makeApprovalRequest(),
            details: { request_id: 'request-1', ux: { options: [{ id: 'red', label: 'Red' }] } },
        };

        expect(getRequestInputResponseMetadata(request, { source: 'free-response' })).toEqual({
            source: 'free-response',
            request_input_response: { request_id: 'request-1' },
        });
    });

    it('does not let an earlier response resolve a later prompt that reused its request id', () => {
        const firstRequest = {
            ...makeApprovalRequest(),
            details: { request_id: 'reused-request', ux: { options: [{ id: 'allow_once' }] } },
        };
        const firstAnswer = {
            ...makeUserAnswer('allow_once'),
            details: { request_input_response: { request_id: 'reused-request' } },
        };
        const secondRequest = {
            ...makeApprovalRequest(),
            timestamp: 3,
            details: { request_id: 'reused-request', ux: { options: [{ id: 'allow_once' }] } },
        };

        const answered = getAnsweredRequestInputKeys([firstRequest, firstAnswer, secondRequest]);

        expect(answered.has(getRequestInputMessageKey(firstRequest))).toBe(true);
        expect(answered.has(getRequestInputMessageKey(secondRequest))).toBe(false);
        expect(getPendingRequestInputMessage([firstRequest, firstAnswer, secondRequest])).toBe(secondRequest);
    });

    it('reads a request id from response metadata', () => {
        expect(
            getRequestInputResponseIdFromMetadata({
                request_input_response: { request_id: 'request-1' },
            }),
        ).toBe('request-1');
        expect(getRequestInputResponseIdFromMetadata({ request_input_response: {} })).toBeUndefined();
    });
});
