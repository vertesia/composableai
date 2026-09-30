import { type AgentMessage, type AgentMessageDetails, AgentMessageType } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { findBudgetPause, parseBudgetAmount, suggestedBudgetAllocation } from './budgetPause';

function message(type: AgentMessageType, details?: Record<string, unknown>): AgentMessage {
    return {
        timestamp: 1,
        workflow_run_id: 'run-1',
        type,
        message: 'status',
        details: details as AgentMessageDetails | undefined,
    };
}

describe('findBudgetPause', () => {
    it('should report the usage of the latest awaiting_budget status', () => {
        const pause = findBudgetPause([
            message(AgentMessageType.ANSWER),
            message(AgentMessageType.IDLE, {
                status_reason: 'awaiting_budget',
                budget_used_units: 1_050_000,
                budget_limit_tokens: 1_000_000,
            }),
            message(AgentMessageType.QUESTION),
        ]);
        expect(pause).toEqual({ requestId: 'run-1:1', usedUnits: 1_050_000, limitTokens: 1_000_000 });
    });

    it('should clear the pause once a budget_allocated status follows it', () => {
        expect(
            findBudgetPause([
                message(AgentMessageType.IDLE, { status_reason: 'awaiting_budget' }),
                message(AgentMessageType.UPDATE, { status_reason: 'budget_allocated' }),
            ]),
        ).toBeUndefined();
    });

    it('should report a later pause after an earlier allocation', () => {
        expect(
            findBudgetPause([
                message(AgentMessageType.IDLE, { status_reason: 'awaiting_budget' }),
                message(AgentMessageType.UPDATE, { status_reason: 'budget_allocated' }),
                message(AgentMessageType.IDLE, { status_reason: 'awaiting_budget', budget_limit_tokens: 1_500_000 }),
            ]),
        ).toEqual({ requestId: 'run-1:1', usedUnits: undefined, limitTokens: 1_500_000 });
    });

    it('should find no pause in a conversation without budget statuses', () => {
        expect(findBudgetPause([message(AgentMessageType.ANSWER), message(AgentMessageType.IDLE)])).toBeUndefined();
    });
});

describe('suggestedBudgetAllocation', () => {
    it('should offer half the reached limit, rounded to 10,000', () => {
        expect(suggestedBudgetAllocation({ limitTokens: 1_234_567 })).toBe(620_000);
    });

    it('should offer at least 100,000', () => {
        expect(suggestedBudgetAllocation({ limitTokens: 50_000 })).toBe(100_000);
        expect(suggestedBudgetAllocation({})).toBe(100_000);
    });
});

describe('parseBudgetAmount', () => {
    it('should read a whole number, with or without digit grouping', () => {
        expect(parseBudgetAmount('150000')).toBe(150_000);
        expect(parseBudgetAmount(' 150,000 ')).toBe(150_000);
        expect(parseBudgetAmount('150 000')).toBe(150_000);
    });

    it('should reject zero, negatives, decimals and text', () => {
        for (const value of ['0', '-5', '1.5', '10k', '', 'more']) {
            expect(parseBudgetAmount(value)).toBeUndefined();
        }
    });
});

it('reads reported and estimated USD from persisted budget pause messages', () => {
    expect(
        findBudgetPause([
            message(AgentMessageType.IDLE, {
                status_reason: 'awaiting_budget',
                budget_limit_usd: 2,
                budget_reported_usd: 1.5,
                budget_estimated_usd: 0.6,
                budget_used_units: 50,
                budget_limit_tokens: 1000,
            }),
        ]),
    ).toEqual({
        requestId: 'run-1:1',
        limitUsd: 2,
        reportedUsd: 1.5,
        estimatedUsd: 0.6,
        usedUnits: 50,
        limitTokens: 1000,
    });
});
