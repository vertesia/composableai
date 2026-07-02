/**
 * Rate Limiter Types
 */

export interface RateLimiterCapacity {
    current: number;
    base: number;
    max: number;
}

export interface RateLimiterBreakerState {
    state: 'open' | 'closed';
    is_open: boolean;
    last_opened_at?: string;
    consecutive_failures?: number;
}

export interface RateLimiterModelStatus {
    model_id: string;
    admitted: number;
    delayed: number;
    capacity: RateLimiterCapacity;
    breaker: RateLimiterBreakerState;
    last_updated: string;
}

export interface RateLimiterStatus {
    environment_id: string;
    model_id: string;
    status: RateLimiterModelStatus;
}

// Always return an array for consistency
export type RateLimiterStatusResponse = RateLimiterStatus[];

/**
 * A caller's own quota standing (GET /api/v1/quota/standing) — "where am I".
 * API rate limits are genuinely per-tenant; workflow admission and the LLM limiter are
 * global/discovered, so they are reported as posture, not per-tenant numbers.
 */
export interface QuotaStandingWindow {
    /** Effective limit for this window (after effective account tier + per-tenant override). */
    limit: number;
    /** Requests used in the current window. */
    used: number;
    /** Requests remaining (max(0, limit - used)). */
    remaining: number;
    window_ms: number;
}

export interface QuotaStandingResource {
    resource: string;
    name: string;
    burst: QuotaStandingWindow;
    quota: QuotaStandingWindow;
}

export interface QuotaStandingAdmissionClass {
    /** Workflow class (e.g. ExecuteConversationWorkflow). */
    class: string;
    /** This tenant's currently active (leased) slots for the class. */
    tenant_active: number;
}

export interface QuotaStandingResponse {
    tenant_id: string;
    /**
     * False when the limiter store (Redis) was unavailable, so `api`/`admission` are empty because
     * standing could not be read — NOT because there are no limits. Limiters fail open in this case.
     */
    available: boolean;
    /** Deployment base tier (env QUOTA_BASE_TIER); `default` = the static limits stand. */
    base_tier: string;
    /**
     * Tier used to compute the API limits below: explicit account `quota_tier`, else account_type
     * derived tier, else `base_tier` when the account tier could not be resolved.
     */
    effective_tier: string;
    /** Per-resource API rate-limit standing (effective limits + current usage). */
    api: QuotaStandingResource[];
    /**
     * Workflow admission: per-tenant active slots per probed class. The budget itself is global and
     * discovered (AIMD), not a per-tenant number — this is occupancy, not a limit.
     */
    admission: {
        classes: QuotaStandingAdmissionClass[];
        note: string;
    };
    /** The LLM interaction limiter is shared per environment/model, not per tenant. */
    llm: {
        note: string;
    };
}

/**
 * Lightweight per-account quota tier for the calling account — served by `GET /api/v1/quota/tier`.
 * A cheap, cacheable read that lets another service (e.g. zeno-server's API rate limiter) resolve
 * the caller's tier through studio-server instead of reaching into the account store directly.
 * `tier` is the SAME value {@link QuotaStandingResponse.effective_tier} reports: the account's
 * explicit `quota_tier`, else its account_type-derived tier, else the deployment base tier when the
 * account tier cannot be resolved.
 */
export interface QuotaTierResponse {
    tier: QuotaStandingResponse['effective_tier'];
}
