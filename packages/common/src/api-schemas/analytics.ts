import { z } from 'zod';

/**
 * The run-analytics query and its result rows.
 *
 * `POST /environments/:envId/analytics` and `POST /analytics` take the same body, so the components
 * are shared rather than duplicated per resource.
 */

export const TimeResolutionSchema = z
    .enum(['minute', 'hour', 'day', 'week', 'month', 'year'])
    .meta({ id: 'TimeResolution' });

export const RunAnalyticsGroupBySchema = z
    .enum(['interaction', 'modelId', 'project', 'status', 'tags', 'environment'])
    .meta({ id: 'RunAnalyticsGroupBy' });

export const AnalyticsAxisSchema = z
    .strictObject({
        environment: z.string().optional(),
        project: z.string().optional(),
        interactions: z.array(z.string()).optional(),
        models: z.array(z.string()).optional(),
        status: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        selectedOnly: z.boolean().optional(),
    })
    .meta({ id: 'AnalyticsAxis' });

export const RunAnalyticsQuerySchema = z
    .strictObject({
        filterBy: AnalyticsAxisSchema.meta({ description: 'filters to apply to the query' }),
        groupBy: RunAnalyticsGroupBySchema.meta({ description: 'The field to group by' }).optional(),
        from: z.number().meta({ description: 'The start date of the query in EPOCH format' }).optional(),
        to: z.number().meta({ description: 'The end date of the query in EPOCH format' }).optional(),
        resolution: TimeResolutionSchema.meta({
            description: 'The time resolution unit of the analytics query',
        }).optional(),
        resolutionStep: z
            .number()
            .meta({
                description:
                    "The step size for the resolution (e.g., 4 with resolution='hour' means 4-hour " +
                    'intervals). Defaults to 1.',
            })
            .optional(),
        virtual: z.boolean().meta({ description: 'The field to sort by' }).optional(),
    })
    .meta({ id: 'RunAnalyticsQuery' });

export const RunAnalyticsResultSchema = z
    .strictObject({
        date: z.string(),
        timestamp: z.string(),
        group: z.string(),
        count: z.number(),
        execution_time: z.strictObject({
            avg: z.number(),
            min: z.number(),
            max: z.number(),
        }),
    })
    .meta({ id: 'RunAnalyticsResult' });

export const RunAnalyticsResultArraySchema = z.array(RunAnalyticsResultSchema).meta({ id: 'RunAnalyticsResultArray' });

export const RunOriginSchema = z.enum(['direct', 'workflow', 'agent', 'unknown']).meta({ id: 'RunOrigin' });

export const RunsAnalyticsFilterQuerySchema = z
    .strictObject({
        start: z.string().meta({ format: 'date-time' }).optional(),
        end: z.string().meta({ format: 'date-time' }).optional(),
        environment: z.string().optional(),
        interaction: z.string().optional(),
        status: z.enum(['created', 'processing', 'completed', 'failed', 'in_progress']).optional(),
        origin: RunOriginSchema.optional(),
    })
    .meta({ id: 'RunsAnalyticsFilterQuery' });

export const EntityStatusCountsSchema = z
    .strictObject({
        id: z.string(),
        name: z.string().optional(),
        version: z.number().optional(),
        status: z.string().optional(),
        total: z.number().nullable(),
        byStatus: z.record(z.string(), z.number().nullable()),
        hasErrors: z.boolean().optional(),
    })
    .meta({ id: 'EntityStatusCounts' });

export const AnalyticsQueryStatsSchema = z
    .strictObject({ total: z.number(), failed: z.number() })
    .meta({ id: 'AnalyticsQueryStats' });

export const RunsAnalyticsSummarySchema = z
    .strictObject({
        total: z.number().nullable(),
        byStatus: z.record(z.string(), z.number().nullable()),
        byEnvironment: z.array(EntityStatusCountsSchema),
        byInteraction: z.array(EntityStatusCountsSchema),
        byCodeInteraction: z.array(EntityStatusCountsSchema).optional(),
        byOrigin: z.array(EntityStatusCountsSchema),
        queryStats: AnalyticsQueryStatsSchema,
    })
    .meta({ id: 'RunsAnalyticsSummary' });

export const RunTimeSeriesPointSchema = z
    .strictObject({
        timestamp: z.string().meta({ format: 'date-time' }),
        count: z.number(),
    })
    .meta({ id: 'RunTimeSeriesPoint' });

export const RunTimeSeriesSchema = z.array(RunTimeSeriesPointSchema).meta({ id: 'RunTimeSeries' });

export const TokenUsageByEnvironmentSchema = z
    .strictObject({
        environmentId: z.string(),
        environmentName: z.string(),
        totalPromptTokens: z.number().nullable(),
        inputTokens: z.number().nullable(),
        cachedInputTokens: z.number().nullable(),
        cacheWriteInputTokens: z.number().nullable(),
        outputTokens: z.number().nullable(),
    })
    .meta({ id: 'TokenUsageByEnvironment' });

export const TokenUsageSummarySchema = z
    .strictObject({
        byEnvironment: z.array(TokenUsageByEnvironmentSchema),
        queryStats: AnalyticsQueryStatsSchema,
    })
    .meta({ id: 'TokenUsageSummary' });

export const RunLifecycleReconciliationPayloadSchema = z
    .strictObject({
        project_id: z.string().optional(),
        window_hours: z
            .number()
            .int()
            .min(1)
            .max(24 * 30)
            .optional(),
        settle_lag_minutes: z
            .number()
            .int()
            .min(0)
            .max(24 * 60)
            .optional(),
        dry_run: z.boolean().optional(),
    })
    .meta({ id: 'RunLifecycleReconciliationPayload' });

export const RunLifecycleReconciliationResponseSchema = z
    .strictObject({
        checked: z.number(),
        missing: z.number(),
        mismatched: z.number(),
        repaired: z.number(),
    })
    .meta({ id: 'RunLifecycleReconciliationResponse' });
