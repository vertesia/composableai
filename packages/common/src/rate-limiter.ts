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