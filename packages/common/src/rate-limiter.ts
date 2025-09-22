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
    lastOpenedAt?: string;
    consecutiveFailures?: number;
}

export interface RateLimiterModelStatus {
    modelId: string;
    admitted: number;
    delayed: number;
    capacity: RateLimiterCapacity;
    breaker: RateLimiterBreakerState;
    lastUpdated: string;
}

export interface RateLimiterStatus {
    environmentId: string;
    modelId: string;
    status: RateLimiterModelStatus;
}

// Always return an array for consistency
export type RateLimiterStatusResponse = RateLimiterStatus[];