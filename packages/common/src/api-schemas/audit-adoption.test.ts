import { describe, expect, it } from 'vitest';
import {
    AuditAdoptionQuerySchema,
    AuditAdoptionResponseSchema,
    AuditUsageCountsSchema,
    AuditUsageQuerySchema,
} from './audit-trail.js';
import { ApiSchemaComponents } from './registry.js';

describe('audit adoption contracts', () => {
    it('registers usage trends with no activity filters or caller-selected account', () => {
        for (const name of ['AuditUsageQuery', 'AuditUsageCounts', 'AuditUsageBucket', 'AuditUsageResponse']) {
            expect(ApiSchemaComponents[name]).toMatchObject({ type: 'object', additionalProperties: false });
        }
        expect(AuditUsageQuerySchema.safeParse({ filter: { actions: ['create'] } }).success).toBe(false);
        expect(AuditUsageQuerySchema.safeParse({ accountId: 'other' }).success).toBe(false);
        expect(AuditUsageQuerySchema.safeParse({ projectId: 'p', from: '2026-01-01T00:00:00Z' }).success).toBe(true);
        expect(AuditUsageCountsSchema.safeParse({ active_users: -1 }).success).toBe(false);
    });
    it('registers closed canonical schemas without an actor or coverage configuration input', () => {
        for (const name of ['AuditAdoptionQuery', 'AuditAdoptionResponse', 'AuditAdoptionHistory']) {
            expect(ApiSchemaComponents[name]).toMatchObject({ type: 'object', additionalProperties: false });
        }
        expect(AuditAdoptionQuerySchema.safeParse({ filter: { principalTypes: ['agent'] } }).success).toBe(false);
        expect(AuditAdoptionQuerySchema.safeParse({ accountId: 'other' }).success).toBe(false);
        expect(AuditAdoptionQuerySchema.safeParse({ filter: { providers: ['openai'] } }).success).toBe(false);
        expect(AuditAdoptionQuerySchema.safeParse({ filter: { eventCategories: ['unknown'] } }).success).toBe(false);
    });

    it('accepts unavailable ratios as null, but never missing values or caller identities', () => {
        const response = {
            period: { from: '2026-09-01T00:00:00Z', to: '2026-10-01T00:00:00Z' },
            previous_period: { from: '2026-08-02T00:00:00Z', to: '2026-09-01T00:00:00Z' },
            resolution: 'day',
            active_users: 0,
            previous_active_users: 0,
            retained_users: 0,
            observed_retention: null,
            returning_user_share: null,
            repeat_user_share: null,
            median_active_days: null,
            active_projects: null,
            timeline: [],
            active_day_distribution: [],
            top_projects: [],
            history: {
                earliest_observed_at: null,
                coverage_from: null,
                completeness: 'unknown',
                retention_unavailable_reason: 'no_previous_users',
            },
        };
        expect(AuditAdoptionResponseSchema.safeParse(response).success).toBe(true);
        expect(AuditAdoptionResponseSchema.safeParse({ ...response, observed_retention: 1.5 }).success).toBe(false);
        expect(AuditAdoptionResponseSchema.safeParse({ ...response, principal_id: 'user:a' }).success).toBe(false);
        expect(AuditAdoptionResponseSchema.safeParse({ ...response, active_users: undefined }).success).toBe(false);
    });
});
