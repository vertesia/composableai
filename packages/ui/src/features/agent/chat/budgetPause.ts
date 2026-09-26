import type { AgentMessage } from '@vertesia/common';

export interface BudgetPause {
    /** Weighted tokens used when the run paused. */
    usedUnits?: number;
    /** Limit the run reached. */
    limitTokens?: number;
}

/**
 * Whether the run is paused because its token budget ran out: the latest budget status message
 * says `awaiting_budget` and no `budget_allocated` came after it. Interactive runs post these
 * instead of ending when their budget runs out.
 */
export function findBudgetPause(messages: readonly AgentMessage[]): BudgetPause | undefined {
    for (let index = messages.length - 1; index >= 0; index--) {
        const details = messages[index].details as Record<string, unknown> | undefined;
        const reason = details?.status_reason;
        if (reason === 'budget_allocated') return undefined;
        if (reason === 'awaiting_budget') {
            return {
                usedUnits: typeof details?.budget_used_units === 'number' ? details.budget_used_units : undefined,
                limitTokens: typeof details?.budget_limit_tokens === 'number' ? details.budget_limit_tokens : undefined,
            };
        }
    }
    return undefined;
}

/** Amount offered by default: half the limit the run reached, rounded, at least 100,000. */
export function suggestedBudgetAllocation(pause: BudgetPause): number {
    const half = Math.round((pause.limitTokens ?? 0) / 2 / 10_000) * 10_000;
    return Math.max(100_000, half);
}
