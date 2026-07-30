/**
 * Rate Limiter Types
 */

import type {
    QuotaEffectiveTierFromSchema,
    QuotaStandingAdmissionClassFromSchema,
    QuotaStandingResourceFromSchema,
    QuotaStandingResponseFromSchema,
    QuotaStandingWindowFromSchema,
    QuotaTierResponseFromSchema,
} from './api-schemas/quota.js';

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
 * The quota contract as it crosses the wire, served by `GET /api/v1/quota/standing` and
 * `GET /api/v1/quota/tier`.
 *
 * Derived from the schemas in `./api-schemas/quota.js`, not written alongside them: those schemas
 * are what OpenAPI publishes and what AJV compiles, so a hand-written twin here could only ever
 * drift from the contract actually being enforced. The documentation lives with the schemas too —
 * zod reads `.meta()`, not TSDoc, so a comment here would describe the type while the published
 * description came from somewhere else.
 *
 * `import type` erases at compile time, so nothing here pulls zod into a browser or SDK bundle;
 * runtime consumers reach the schemas through the `@vertesia/common/api-schemas` entry point.
 */
export type QuotaStandingWindow = QuotaStandingWindowFromSchema;
export type QuotaStandingResource = QuotaStandingResourceFromSchema;
export type QuotaStandingAdmissionClass = QuotaStandingAdmissionClassFromSchema;
export type QuotaEffectiveTier = QuotaEffectiveTierFromSchema;
export type QuotaStandingResponse = QuotaStandingResponseFromSchema;
export type QuotaTierResponse = QuotaTierResponseFromSchema;
