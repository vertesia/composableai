import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import {
    clearRequestInputIdAnsweredForSession,
    getAnsweredRequestInputKeys,
    getAnsweredToolApprovalRequestInputKeys,
    getPendingRequestInputMessage,
    getRequestInputMessageKey,
    getRequestInputResponseIdFromMetadata,
    getRequestInputResponseMetadata,
    getToolApprovalEditConfig,
    getToolApprovalEditResponseMetadata,
    getToolApprovalResponseMetadata,
    isRequestInputAnsweredForSession,
    markRequestInputIdAnsweredForSession,
    TOOL_APPROVAL_REDACTED_PLACEHOLDER,
    validateToolApprovalEdit,
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

function makeApprovalRequestForToolUse(toolUseId: string): AgentMessage {
    const request = makeApprovalRequest();
    return {
        ...request,
        details: { ...(request.details as Record<string, unknown>), request_id: toolUseId },
    } as unknown as AgentMessage;
}

function makeApprovalReleasedMessage(toolUseId: string, timestamp: number): AgentMessage {
    return {
        timestamp,
        type: AgentMessageType.UPDATE,
        message: 'Approval reviewer allowed Create a new draft interaction.',
        workstream_id: 'main',
        details: {
            request_id: toolUseId,
            approval_decision: 'auto_approved',
            approval_release_reason: 'reviewer_allowed',
            approval_request: { tool_name: 'create_interaction', approval_key: APPROVAL_KEY },
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
    it('does not apply session acknowledgement to non-request-input messages with the same id', () => {
        const agentRunId = 'agent-run-1';
        const requestId = 'request-1';
        const request = {
            ...makeApprovalRequest(),
            details: { request_id: requestId, ux: { options: [{ id: 'allow_once' }] } },
        };
        const unrelatedMessage = {
            ...makeUserAnswer('Still working'),
            details: { request_id: requestId },
        };

        markRequestInputIdAnsweredForSession(agentRunId, requestId);

        expect(isRequestInputAnsweredForSession(agentRunId, request)).toBe(true);
        expect(isRequestInputAnsweredForSession(agentRunId, unrelatedMessage)).toBe(false);

        clearRequestInputIdAnsweredForSession(agentRunId, requestId);
    });

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

    it('stops asking once the workflow releases the approval without a user answer', () => {
        const request = makeApprovalRequestForToolUse('write-1');
        const released = makeApprovalReleasedMessage('write-1', 3);

        expect(getPendingRequestInputMessage([request])).toBe(request);
        expect(getPendingRequestInputMessage([request, released])).toBeUndefined();
    });

    it('keeps asking for a later request that reuses a released approval key', () => {
        // Approval keys are `tool_name:target`, so the same action repeats across turns: a release
        // must resolve the request it answered, not every prompt that shares its key.
        const firstRequest = makeApprovalRequestForToolUse('write-1');
        const released = makeApprovalReleasedMessage('write-1', 3);
        const laterRequest = { ...makeApprovalRequestForToolUse('write-2'), timestamp: 4 };

        expect(getPendingRequestInputMessage([firstRequest, released, laterRequest])).toBe(laterRequest);
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

describe('"Edit and run" on a tool approval prompt', () => {
    const SHOWN_INPUT = {
        name: 'Quarterly plan',
        api_key: TOOL_APPROVAL_REDACTED_PLACEHOLDER,
        headers: { authorization: TOOL_APPROVAL_REDACTED_PLACEHOLDER, trace: 'one' },
    };

    function makeEditableRequest(supportsEdit: unknown = true, input: unknown = SHOWN_INPUT): AgentMessage {
        const request = makeApprovalRequestForToolUse('tool-1');
        const details = request.details as Record<string, unknown>;
        return {
            ...request,
            details: {
                ...details,
                tool_approval: {
                    ...(details.tool_approval as Record<string, unknown>),
                    input,
                    supports_edit: supportsEdit,
                },
            },
        } as unknown as AgentMessage;
    }

    it('is offered only when the worker says the call can be edited', () => {
        expect(getToolApprovalEditConfig(makeApprovalRequest())).toBeUndefined();
        expect(getToolApprovalEditConfig(makeEditableRequest(false))).toBeUndefined();
        expect(getToolApprovalEditConfig(makeEditableRequest('true'))).toBeUndefined();
        expect(getToolApprovalEditConfig(makeEditableRequest())).toEqual({
            input: SHOWN_INPUT,
            redactedPaths: ['api_key', 'headers.authorization'],
            lockedArrayPaths: [],
        });
    });

    it('sends the decision, the prompt it answers and the edited arguments', () => {
        const input = { ...SHOWN_INPUT, name: 'Q4 plan' };
        expect(getToolApprovalEditResponseMetadata(makeEditableRequest(), input)).toEqual({
            tool_approval_response: {
                decision: 'allow_edited',
                approval_key: APPROVAL_KEY,
                request_id: 'tool-1',
                input,
            },
        });
    });

    it('accepts an edit that keeps or removes the locked fields', () => {
        const config = getToolApprovalEditConfig(makeEditableRequest());
        if (!config) throw new Error('expected an edit config');
        const edited = { ...SHOWN_INPUT, name: 'Q4 plan' };
        expect(validateToolApprovalEdit(config, JSON.stringify(edited))).toEqual({ input: edited });
        const { api_key: _removed, ...withoutKey } = SHOWN_INPUT;
        expect(validateToolApprovalEdit(config, JSON.stringify(withoutKey))).toEqual({ input: withoutKey });
    });

    it('reports each problem with an edit', () => {
        const config = getToolApprovalEditConfig(makeEditableRequest());
        if (!config) throw new Error('expected an edit config');
        const check = (value: unknown) => validateToolApprovalEdit(config, JSON.stringify(value));

        expect(validateToolApprovalEdit(config, '{ name: ')).toEqual({ problem: { code: 'invalid_json' } });
        expect(check(['a'])).toEqual({ problem: { code: 'not_object' } });
        expect(check({ ...SHOWN_INPUT, api_key: 'sk-typed' })).toEqual({
            problem: { code: 'redacted_changed', path: 'api_key' },
        });
        expect(check({ ...SHOWN_INPUT, headers: { authorization: 'Bearer x', trace: 'one' } })).toEqual({
            problem: { code: 'redacted_changed', path: 'headers.authorization' },
        });
        expect(check({ ...SHOWN_INPUT, name: TOOL_APPROVAL_REDACTED_PLACEHOLDER })).toEqual({
            problem: { code: 'placeholder_added', path: 'name' },
        });
        expect(check({ ...SHOWN_INPUT, tags: [TOOL_APPROVAL_REDACTED_PLACEHOLDER] })).toEqual({
            problem: { code: 'placeholder_added', path: 'tags[0]' },
        });
    });

    it('locks an array that holds a redacted value, as the workflow does', () => {
        const shown = {
            name: 'batch',
            calls: [
                { token: TOOL_APPROVAL_REDACTED_PLACEHOLDER, id: 'a' },
                { token: TOOL_APPROVAL_REDACTED_PLACEHOLDER, id: 'b' },
            ],
            tags: ['x'],
        };
        const config = getToolApprovalEditConfig(makeEditableRequest(true, shown));
        if (!config) throw new Error('expected an edit config');
        expect(config.lockedArrayPaths).toEqual(['calls']);
        const check = (value: unknown) => validateToolApprovalEdit(config, JSON.stringify(value));

        const changedId = structuredClone(shown);
        changedId.calls[0].id = 'z';
        expect(check(changedId)).toEqual({ problem: { code: 'locked_array_changed', path: 'calls' } });
        expect(check({ ...shown, calls: [shown.calls[1], shown.calls[0]] })).toEqual({
            problem: { code: 'locked_array_changed', path: 'calls' },
        });
        expect(check({ ...shown, calls: shown.calls.slice(0, 1) })).toEqual({
            problem: { code: 'locked_array_changed', path: 'calls' },
        });

        const { calls: _removed, ...withoutCalls } = shown;
        expect(check(withoutCalls)).toEqual({ input: withoutCalls });
        expect(check({ ...shown, name: 'other', tags: ['x', 'y'] })).toHaveProperty('input');
    });

    it('checks JSON text the way the workflow decodes it', () => {
        const config = getToolApprovalEditConfig(makeEditableRequest());
        if (!config) throw new Error('expected an edit config');
        const check = (value: unknown) => validateToolApprovalEdit(config, JSON.stringify(value));

        expect(check({ ...SHOWN_INPUT, headers: '{"authorization":"Bearer typed","trace":"one"}' })).toEqual({
            problem: { code: 'redacted_changed', path: 'headers.authorization' },
        });
        expect(check({ ...SHOWN_INPUT, note: '{"x":"\\u005BREDACTED]"}' })).toEqual({
            problem: { code: 'placeholder_added', path: 'note.x' },
        });
        expect(check({ ...SHOWN_INPUT, headers: '{"trace":"two"}' })).toHaveProperty('input');
    });

    it('rejects added credentials before sending them, including nested JSON text', () => {
        const config = getToolApprovalEditConfig(makeEditableRequest());
        if (!config) throw new Error('expected an edit config');
        const check = (value: unknown) => validateToolApprovalEdit(config, JSON.stringify(value));

        expect(check({ ...SHOWN_INPUT, password: 'synthetic-password' })).toEqual({
            problem: { code: 'secret_added', path: 'password' },
        });
        expect(
            check({
                ...SHOWN_INPUT,
                options: JSON.stringify({ request: JSON.stringify({ api_key: 'synthetic-key' }) }),
            }),
        ).toEqual({ problem: { code: 'secret_added', path: 'options.request.api_key' } });
        expect(check({ ...SHOWN_INPUT, options: JSON.stringify({ request: '{"x":"\\u005BREDACTED]"}' }) })).toEqual({
            problem: { code: 'placeholder_added', path: 'options.request.x' },
        });
        expect(check({ ...SHOWN_INPUT, options: JSON.stringify({ request: '{"trace":"two"}' }) })).toHaveProperty(
            'input',
        );
    });

    it('locks literal keys containing dots and brackets', () => {
        const shown = {
            'headers.v1': { 'access[token]': TOOL_APPROVAL_REDACTED_PLACEHOLDER },
            'calls[0]': [{ token: TOOL_APPROVAL_REDACTED_PLACEHOLDER, id: 'a' }],
        };
        const config = getToolApprovalEditConfig(makeEditableRequest(true, shown));
        if (!config) throw new Error('expected an edit config');
        const check = (value: unknown) => validateToolApprovalEdit(config, JSON.stringify(value));

        expect(check({ ...shown, 'headers.v1': { 'access[token]': 'synthetic-key' } })).toEqual({
            problem: { code: 'redacted_changed', path: 'headers.v1.access[token]' },
        });
        expect(check({ ...shown, 'calls[0]': [{ token: TOOL_APPROVAL_REDACTED_PLACEHOLDER, id: 'b' }] })).toEqual({
            problem: { code: 'locked_array_changed', path: 'calls[0]' },
        });
        expect(check(shown)).toHaveProperty('input');
    });

    it('marks the prompt answered once the edit is sent', () => {
        const request = makeEditableRequest();
        const metadata = getToolApprovalEditResponseMetadata(request, SHOWN_INPUT);
        const answer = makeUserAnswer('Run this action with my edited arguments.', metadata);
        const answered = getAnsweredToolApprovalRequestInputKeys([request, answer]);
        expect(answered.has(getRequestInputMessageKey(request))).toBe(true);
    });
});
