import { act, cleanup, renderHook } from '@testing-library/react';
import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAgentPlans } from './useAgentPlans.js';

const question: AgentMessage = {
    timestamp: 1,
    workflow_run_id: 'run-1',
    workstream_id: 'main',
    type: AgentMessageType.QUESTION,
    message: 'Help with a task',
};
const plan: AgentMessage = {
    ...question,
    timestamp: 2,
    type: AgentMessageType.PLAN,
    details: { plan: [{ id: 1, goal: 'Review the task', status: 'pending' }] },
};

describe('useAgentPlans sidebar visibility', () => {
    beforeEach(() => sessionStorage.clear());
    afterEach(cleanup);

    it('stays closed while history loads and when history has no plan', () => {
        const { result, rerender } = renderHook(({ messages }) => useAgentPlans(messages, true), {
            initialProps: { messages: [] as AgentMessage[] },
        });
        expect(result.current.showSlidingPanel).toBe(false);
        rerender({ messages: [question] });
        expect(result.current.showSlidingPanel).toBe(false);
    });

    it('opens when a plan arrives and resets for a new empty run', () => {
        const { result, rerender } = renderHook(({ messages }) => useAgentPlans(messages, true), {
            initialProps: { messages: [question] },
        });
        rerender({ messages: [question, plan] });
        expect(result.current.showSlidingPanel).toBe(true);
        expect(result.current.plans).toHaveLength(1);
        rerender({ messages: [] });
        expect(result.current.showSlidingPanel).toBe(false);
    });

    it('preserves manual opening when subsequent messages have no plan', () => {
        const { result, rerender } = renderHook(({ messages }) => useAgentPlans(messages, true), {
            initialProps: { messages: [question] },
        });
        act(() => result.current.setShowSlidingPanel(true));
        rerender({ messages: [question, { ...question, timestamp: 3, type: AgentMessageType.ANSWER }] });
        expect(result.current.showSlidingPanel).toBe(true);
    });
});
