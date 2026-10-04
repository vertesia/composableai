import { z } from 'zod';
import { AUDIT_ACTIONS, AUDIT_AGGREGATION_DIMENSIONS } from '../audit-trail.js';
import { NumberValueMapSchema } from './interaction.js';

// The audit trail: the events `GET /audit-trail` pages through and the aggregation `POST
// /audit-trail/aggregate` computes over them.
//
// `//` rather than `/** */` throughout: a JSDoc block immediately preceding an exported declaration
// is picked up by the OpenAPI scanner and published as that component's `description`, which would
// double up with the `description` stated in `.meta()`.

export const AuditMeterSchema = z
    .strictObject({
        category: z.string(),
        type: z.string(),
        quantity: z.number(),
    })
    .meta({
        id: 'AuditMeter',
        description:
            'Generic metering entry attached to audit events. Used for cost attribution, usage tracking, and billing.\n\nExamples:   { category: "tokens", type: "input", quantity: 1234 }   { category: "tokens", type: "output", quantity: 567 }   { category: "compute", type: "duration_ms", quantity: 2100 }   { category: "processing", type: "pages", quantity: 12 }',
    });

// The two action/dimension vocabularies read their members off the `as const` arrays in
// `../audit-trail.js` rather than restating them: those arrays are what the readers and the
// aggregation validator iterate, so a member added there reaches the document with nothing here
// changing. Everything else in this file is spelled out.
export const KnownAuditActionSchema = z.enum(AUDIT_ACTIONS).meta({ id: 'KnownAuditAction' });

export const EventCategorySchema = z
    .enum(['content', 'workflow', 'security', 'billing', 'system', 'external'])
    .meta({ id: 'EventCategory' });

export const AuditAggregationDimensionMapSchema = z
    .strictObject({
        time: z.string().nullable().optional(),
        action: z.string().nullable().optional(),
        resource_type: z.string().nullable().optional(),
        event_category: z.string().nullable().optional(),
        provider: z.string().nullable().optional(),
        project_id: z.string().nullable().optional(),
        principal_id: z.string().nullable().optional(),
        actor_id: z.string().nullable().optional(),
        'details.pipeline': z.string().nullable().optional(),
        'details.verdict': z.string().nullable().optional(),
        'details.workflow_type': z.string().nullable().optional(),
        'details.rule_id': z.string().nullable().optional(),
        model: z.string().nullable().optional(),
    })
    .meta({ id: 'AuditAggregationDimensionMap' });

export const AuditAggregationDistinctFieldSchema = z
    .enum(['resource_id', 'request_id', 'principal_id', 'actor_id'])
    .meta({ id: 'AuditAggregationDistinctField' });

export const AuditAggregationOperationSchema = z
    .enum(['count', 'count_distinct', 'sum_meter', 'average_meter'])
    .meta({ id: 'AuditAggregationOperation' });

export const AuditAggregationResolutionSchema = z
    .enum(['hour', 'day', 'week', 'month'])
    .meta({ id: 'AuditAggregationResolution' });

export const AuditAggregationDimensionSchema = z
    .enum(AUDIT_AGGREGATION_DIMENSIONS)
    .meta({ id: 'AuditAggregationDimension' });

export const AuditAggregationDetailFieldSchema = z
    .enum(['pipeline', 'verdict', 'workflow_type', 'rule_id'])
    .meta({ id: 'AuditAggregationDetailField' });

export const AuditActionSchema = z.union([KnownAuditActionSchema, z.string()]).meta({ id: 'AuditAction' });

export const AuditAggregationRowSchema = z
    .strictObject({
        dimensions: AuditAggregationDimensionMapSchema,
        metrics: NumberValueMapSchema,
    })
    .meta({ id: 'AuditAggregationRow' });

export const AuditAggregationMetricSchema = z
    .strictObject({
        id: z.string().meta({
            description:
                'Stable key used in response rows. Must contain only letters, numbers, underscores, or hyphens.',
        }),
        operation: AuditAggregationOperationSchema,
        field: AuditAggregationDistinctFieldSchema.meta({ description: 'Required for count_distinct.' }).optional(),
        meterCategory: z.string().meta({ description: 'Required for meter operations.' }).optional(),
        meterType: z.string().meta({ description: 'Required for meter operations.' }).optional(),
    })
    .meta({ id: 'AuditAggregationMetric' });

export const AuditAggregationGroupSchema = z
    .strictObject({
        dimension: AuditAggregationDimensionSchema,
        resolution: AuditAggregationResolutionSchema.meta({
            description: 'Required for the time dimension; defaults to day.',
        }).optional(),
    })
    .meta({ id: 'AuditAggregationGroup' });

export const AuditAggregationDetailFilterSchema = z
    .strictObject({
        field: AuditAggregationDetailFieldSchema,
        values: z.array(z.string()),
    })
    .meta({ id: 'AuditAggregationDetailFilter' });

export const AuditTrailEventSchema = z
    .strictObject({
        event_type: z.literal('audit'),
        event_id: z.string().optional(),
        event_category: EventCategorySchema.optional(),
        source: z.string().nullable().optional(),
        root_event_id: z.string().optional(),
        caused_by_event_id: z.string().optional(),
        hop_count: z.number().optional(),
        audit_trail: z.boolean().optional(),
        replay_of: z.string().optional(),
        replay_root_event_id: z.string().optional(),
        replayed_by: z.string().optional(),
        action: AuditActionSchema,
        resource_type: z.string(),
        resource_id: z.string(),
        timestamp: z.string(),
        request_id: z.string(),
        status: z.number(),
        success: z.boolean(),
        principal_id: z.string().nullable(),
        principal_type: z.string().nullable(),
        effective_principal_id: z.string().nullable(),
        roles: z.array(z.string()),
        account_id: z.string().nullable(),
        project_id: z.string().nullable(),
        tenant_id: z.string().nullable(),
        account_name: z.string().nullable(),
        project_name: z.string().nullable(),
        provider: z
            .string()
            .nullable()
            .meta({ description: 'Provider type for billable/provider-backed events, e.g. vertexai, bedrock.' })
            .optional(),
        meters: z
            .array(AuditMeterSchema)
            .meta({ description: 'Generic metering data for cost attribution and usage tracking' })
            .optional(),
        details: z
            .looseObject({})
            .meta({ description: 'Event-specific metadata — shape varies by action/resource_type' })
            .optional(),
    })
    .meta({ id: 'AuditTrailEvent' });

export const AuditAggregationResponseSchema = z
    .strictObject({
        rows: z.array(AuditAggregationRowSchema),
        from: z.string(),
        to: z.string(),
    })
    .meta({ id: 'AuditAggregationResponse' });

export const AuditAggregationFilterSchema = z
    .strictObject({
        actions: z.array(AuditActionSchema).optional(),
        resourceTypes: z.array(z.string()).optional(),
        eventCategories: z.array(EventCategorySchema).optional(),
        providers: z.array(z.string()).optional(),
        principalTypes: z
            .array(z.string())
            .meta({ description: 'Restrict events to top-level actor categories such as user or apikey.' })
            .optional(),
        success: z.boolean().optional(),
        details: z.array(AuditAggregationDetailFilterSchema).optional(),
    })
    .meta({ id: 'AuditAggregationFilter' });

export const AuditTrailResponseSchema = z
    .strictObject({
        events: z.array(AuditTrailEventSchema),
        hasNext: z.boolean().meta({ description: 'Whether there are more events after this page' }),
        limit: z.number(),
        offset: z.number(),
    })
    .meta({ id: 'AuditTrailResponse' });

export const AuditAggregationQuerySchema = z
    .strictObject({
        projectId: z
            .string()
            .meta({ description: 'Optional account-admin project filter. Ignored for project-scoped principals.' })
            .optional(),
        from: z
            .string()
            .meta({ description: 'Start time; defaults to 30 days before to. The server caps the range at 366 days.' })
            .optional(),
        to: z.string().meta({ description: 'End time; defaults to the current time.' }).optional(),
        filter: AuditAggregationFilterSchema.optional(),
        groupBy: z.array(AuditAggregationGroupSchema).optional(),
        metrics: z.array(AuditAggregationMetricSchema),
        limit: z.number().meta({ description: 'Maximum groups returned (default 50, max 200).' }).optional(),
    })
    .meta({
        id: 'AuditAggregationQuery',
        description:
            'Safe audit aggregation query. The server always applies the authenticated account scope and, for project-scoped principals, replaces projectId with the authenticated project.',
    });

// Query contracts are registry components even though the scanner expands them into parameters.
export const AuditTrailQuerySchema = z
    .strictObject({
        actions: z.array(AuditActionSchema).meta({ description: 'Filter by action types' }).optional(),
        resourceTypes: z.array(z.string()).meta({ description: 'Filter by resource types' }).optional(),
        resourceId: z.string().meta({ description: 'Filter by resource ID' }).optional(),
        principalId: z
            .string()
            .meta({ description: 'Filter by exact actor principal ref (matches principal_id column).' })
            .optional(),
        principalType: z
            .string()
            .meta({ description: 'Filter by top-level actor category (matches principal_type column).' })
            .optional(),
        effectivePrincipalId: z
            .string()
            .meta({
                description:
                    'Filter by delegated/direct effective principal ref (matches effective_principal_id column).',
            })
            .optional(),
        hasEffectivePrincipal: z
            .boolean()
            .meta({ description: 'Filter by whether an event has an effective principal ref.' })
            .optional(),
        projectId: z
            .string()
            .meta({
                description:
                    'Filter by project ID. Honoured only for account-scoped principals; a project-scoped principal always reads its own project.',
            })
            .optional(),
        from: z.string().meta({ description: 'Start time (ISO string)' }).optional(),
        to: z.string().meta({ description: 'End time (ISO string)' }).optional(),
        limit: z
            .number()
            .meta({ description: 'Pagination: number of items to return (default 50, max 200)' })
            .optional(),
        offset: z.number().meta({ description: 'Pagination: offset' }).optional(),
    })
    .meta({ id: 'AuditTrailQuery' });

export const AuditAdoptionFilterSchema = z
    .strictObject({
        actions: z.array(AuditActionSchema).max(32).optional(),
        resourceTypes: z.array(z.string().max(128)).max(16).optional(),
        eventCategories: z.array(EventCategorySchema).max(6).optional(),
    })
    .meta({ id: 'AuditAdoptionFilter' });

export const AuditAdoptionQuerySchema = z
    .strictObject({
        projectId: z.string().optional(),
        from: z
            .string()
            .meta({ format: 'date-time', description: 'Inclusive start; defaults to 30 days before to.' })
            .optional(),
        to: z
            .string()
            .meta({ format: 'date-time', description: 'Exclusive end; defaults to now. Maximum duration: 366 days.' })
            .optional(),
        filter: AuditAdoptionFilterSchema.optional(),
    })
    .meta({
        id: 'AuditAdoptionQuery',
        description:
            'Productive direct authenticated user activity, including user OAuth/MCP calls. Scope is enforced by the server.',
    });

export const AuditAdoptionPeriodSchema = z
    .strictObject({
        from: z.string().meta({ format: 'date-time' }),
        to: z.string().meta({ format: 'date-time' }),
    })
    .meta({ id: 'AuditAdoptionPeriod' });

export const AuditAdoptionBucketSchema = z
    .strictObject({
        from: z.string().meta({ format: 'date-time' }),
        to: z.string().meta({ format: 'date-time' }),
        partial: z.boolean(),
        active_users: z.number().int().nonnegative(),
    })
    .meta({ id: 'AuditAdoptionBucket' });

export const AuditAdoptionActiveDaysSchema = z
    .strictObject({
        days: z.number().int().min(1).max(367),
        users: z.number().int().nonnegative(),
    })
    .meta({ id: 'AuditAdoptionActiveDays' });

export const AuditAdoptionProjectSchema = z
    .strictObject({
        project_id: z.string(),
        project_name: z.string().nullable(),
        active_users: z.number().int().nonnegative(),
        active_user_days: z.number().int().nonnegative(),
    })
    .meta({ id: 'AuditAdoptionProject' });

export const AuditAdoptionHistorySchema = z
    .strictObject({
        earliest_observed_at: z.string().meta({ format: 'date-time' }).nullable(),
        coverage_from: z
            .string()
            .meta({
                format: 'date-time',
                description:
                    'Authoritative complete-history boundary, if known. Earliest observation is not a coverage boundary.',
            })
            .nullable(),
        completeness: z.enum(['unknown', 'insufficient', 'verified']),
        retention_unavailable_reason: z.enum(['no_previous_users', 'insufficient_history']).nullable(),
    })
    .meta({ id: 'AuditAdoptionHistory' });

export const AuditAdoptionResponseSchema = z
    .strictObject({
        period: AuditAdoptionPeriodSchema,
        previous_period: AuditAdoptionPeriodSchema,
        resolution: z.enum(['day', 'week']),
        active_users: z.number().int().nonnegative(),
        previous_active_users: z.number().int().nonnegative(),
        retained_users: z.number().int().nonnegative(),
        observed_retention: z.number().min(0).max(1).nullable(),
        returning_user_share: z.number().min(0).max(1).nullable(),
        repeat_user_share: z.number().min(0).max(1).nullable(),
        median_active_days: z.number().nonnegative().nullable(),
        active_projects: z.number().int().nonnegative().nullable(),
        timeline: z.array(AuditAdoptionBucketSchema),
        active_day_distribution: z.array(AuditAdoptionActiveDaysSchema),
        top_projects: z.array(AuditAdoptionProjectSchema).max(10),
        history: AuditAdoptionHistorySchema,
    })
    .meta({
        id: 'AuditAdoptionResponse',
        description:
            'Distinct user adoption sets over two equal-duration half-open periods. Ratios use available audit history, not guaranteed historical coverage. No user identities are returned.',
    });

export const AuditUsageQuerySchema = AuditAdoptionQuerySchema.omit({ filter: true })
    .extend({
        resolution: z.enum(['day', 'week', 'month']).optional().meta({
            description: 'UTC calendar buckets. Weeks start Monday. Omitted: daily up to 200 dates, otherwise weekly.',
        }),
    })
    .meta({
        id: 'AuditUsageQuery',
        description: 'Usage trends for an authorized account or project over a half-open interval of at most 366 days.',
    });

export const AuditUsageCountsSchema = z
    .strictObject({
        active_users: z.number().int().nonnegative(),
        agent_runs: z.number().int().nonnegative(),
        agent_users: z.number().int().nonnegative(),
        direct_calls: z.number().int().nonnegative(),
        direct_call_users: z.number().int().nonnegative(),
        content_objects: z.number().int().nonnegative(),
        user_content_objects: z.number().int().nonnegative(),
        other_content_objects: z.number().int().nonnegative(),
    })
    .meta({
        id: 'AuditUsageCounts',
        description: 'Distinct users and objects; user-initiated run operations and standalone inference audit events.',
    });

export const AuditUsageBucketSchema = z
    .strictObject({
        from: z.string().meta({ format: 'date-time' }),
        to: z.string().meta({ format: 'date-time' }),
        partial: z.boolean(),
        counts: AuditUsageCountsSchema,
    })
    .meta({ id: 'AuditUsageBucket' });

export const AuditUsageResponseSchema = z
    .strictObject({
        period: AuditAdoptionPeriodSchema,
        resolution: z.enum(['day', 'week', 'month']),
        totals: AuditUsageCountsSchema,
        timeline: z.array(AuditUsageBucketSchema),
    })
    .meta({
        id: 'AuditUsageResponse',
        description:
            'UTC usage trends. Period-wide distinct users are not sums of bucket populations. No user identities are returned.',
    });
