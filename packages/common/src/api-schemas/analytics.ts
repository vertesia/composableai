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
