import type { z } from 'zod';
import type {
    AnalyticsAxisSchema,
    AnalyticsQueryStatsSchema,
    EntityStatusCountsSchema,
    RunAnalyticsGroupBySchema,
    RunAnalyticsQuerySchema,
    RunAnalyticsResultSchema,
    RunLifecycleReconciliationPayloadSchema,
    RunLifecycleReconciliationResponseSchema,
    RunOriginSchema,
    RunsAnalyticsFilterQuerySchema,
    RunsAnalyticsSummarySchema,
    RunTimeSeriesPointSchema,
    RunTimeSeriesSchema,
    TimeResolutionSchema,
    TokenUsageByEnvironmentSchema,
    TokenUsageSummarySchema,
} from './api-schemas/analytics.js';

/**
 * The five run-analytics contract types, inferred from `./api-schemas/analytics.js`. Their
 * documentation moved with them — a doc comment here would be published on TOP of the schema's
 * `description` and the two would drift.
 */
export type AnalyticsAxis = z.infer<typeof AnalyticsAxisSchema>;

export type RunAnalyticsQuery = z.infer<typeof RunAnalyticsQuerySchema>;

export type RunAnalyticsGroupBy = z.infer<typeof RunAnalyticsGroupBySchema>;

export type TimeResolution = z.infer<typeof TimeResolutionSchema>;

export type RunAnalyticsResult = z.infer<typeof RunAnalyticsResultSchema>;

/** Entity with status breakdown */
export type RunOrigin = z.infer<typeof RunOriginSchema>;
export type RunsAnalyticsFilterQuery = z.infer<typeof RunsAnalyticsFilterQuerySchema>;
export type EntityStatusCounts = z.infer<typeof EntityStatusCountsSchema>;
export type AnalyticsQueryStats = z.infer<typeof AnalyticsQueryStatsSchema>;

/** Scalable analytics summary */
export type RunsAnalyticsSummary = z.infer<typeof RunsAnalyticsSummarySchema>;
export type RunTimeSeriesPoint = z.infer<typeof RunTimeSeriesPointSchema>;
export type RunTimeSeries = z.infer<typeof RunTimeSeriesSchema>;
export type RunLifecycleReconciliationPayload = z.infer<typeof RunLifecycleReconciliationPayloadSchema>;
export type RunLifecycleReconciliationResponse = z.infer<typeof RunLifecycleReconciliationResponseSchema>;

/** Date range filter for analytics queries */
export type DateRangeQuery = Pick<RunsAnalyticsFilterQuery, 'start' | 'end'>;

/** Token usage for a single environment */
export type TokenUsageByEnvironment = z.infer<typeof TokenUsageByEnvironmentSchema>;

/** Summary of token usage by environment (requires { environment: 1, created_at: -1, "token_use.prompt": 1 } index) */
export type TokenUsageSummary = z.infer<typeof TokenUsageSummarySchema>;
