import {
    AGENT_BUDGET_STATUS_ALLOCATED,
    AGENT_BUDGET_STATUS_AWAITING,
    type AgentBudgetStatusDetails,
    type AgentMessage,
} from '@vertesia/common';

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
        // Untrusted until checked: any message can carry details.
        const details = messages[index].details as Partial<Record<keyof AgentBudgetStatusDetails, unknown>> | undefined;
        const reason = details?.status_reason;
        if (reason === AGENT_BUDGET_STATUS_ALLOCATED) return undefined;
        if (reason === AGENT_BUDGET_STATUS_AWAITING) {
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

/** Reads a typed budget amount, allowing digit grouping ("150,000", "150 000"): a whole number above zero. */
export function parseBudgetAmount(value: string): number | undefined {
    const digits = value.replace(/[\s,_]/g, '');
    if (!/^\d+$/.test(digits)) return undefined;
    const amount = Number(digits);
    return Number.isSafeInteger(amount) && amount > 0 ? amount : undefined;
}
