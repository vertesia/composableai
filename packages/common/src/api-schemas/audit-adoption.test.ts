import { describe, expect, it } from 'vitest';
import {
    AuditAdoptionQuerySchema,
    AuditAdoptionResponseSchema,
    AuditTrailQuerySchema,
    AuditUsageCountsSchema,
    AuditUsageQuerySchema,
} from './audit-trail.js';
import { ApiSchemaComponents, validateApiRequest } from './registry.js';

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

describe('audit aggregation query contract', () => {
    const metric = { id: 'events', operation: 'count' };
    // Each body is one the aggregation validator accepts or refuses on a single field, so the published schema
    // refuses it first.
    it.each([
        ['one metric', { metrics: [metric] }, true],
        ['no metric', { metrics: [] }, false],
        ['thirteen metrics', { metrics: Array.from({ length: 13 }, (_, i) => ({ ...metric, id: `m${i}` })) }, false],
        ['an empty metric id', { metrics: [{ ...metric, id: '' }] }, false],
        ['a metric id with punctuation', { metrics: [{ ...metric, id: 'a.b' }] }, false],
        ['a 65-character metric id', { metrics: [{ ...metric, id: 'a'.repeat(65) }] }, false],
        [
            'three dimensions',
            { metrics: [metric], groupBy: [{ dimension: 'time' }, { dimension: 'action' }, { dimension: 'model' }] },
            false,
        ],
        ['a limit of zero', { metrics: [metric], limit: 0 }, false],
        ['a fractional limit', { metrics: [metric], limit: 1.5 }, false],
        ['a limit above the cap', { metrics: [metric], limit: 500 }, true],
        ['an empty resource type', { metrics: [metric], filter: { resourceTypes: [''] } }, false],
        [
            'a detail filter with no value',
            { metrics: [metric], filter: { details: [{ field: 'pipeline', values: [] }] } },
            false,
        ],
    ])('%s: valid is %s', (_case, body, valid) => {
        const result = validateApiRequest('AuditAggregationQuery', body);

        expect(result.valid, JSON.stringify(result.valid ? null : result.issues)).toBe(valid);
    });
});

describe('audit trail time bounds', () => {
    it.each([
        ['', true],
        ['2026-01-31', true],
        ['2026-01-31T12:00:00Z', true],
        ['2026-01-31T12:00:00.123456789+02:00', true],
        ['2026-13-01', false],
        ['0050-01-01', false],
        ['yesterday', false],
    ])('%j: valid is %s', (to, valid) => {
        expect(AuditTrailQuerySchema.safeParse({ to }).success).toBe(valid);
    });
});
