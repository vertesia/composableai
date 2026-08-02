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

export const Partial_Record_AuditAggregationDimension_string_nullSchema = z
    .strictObject({
        time: z.string().nullable().optional(),
        action: z.string().nullable().optional(),
        resource_type: z.string().nullable().optional(),
        event_category: z.string().nullable().optional(),
        provider: z.string().nullable().optional(),
        project_id: z.string().nullable().optional(),
        'details.pipeline': z.string().nullable().optional(),
        'details.verdict': z.string().nullable().optional(),
        'details.workflow_type': z.string().nullable().optional(),
        'details.rule_id': z.string().nullable().optional(),
        model: z.string().nullable().optional(),
    })
    .meta({ id: 'Partial_Record_AuditAggregationDimension_string_null' });

export const AuditAggregationDistinctFieldSchema = z
    .enum(['resource_id', 'request_id'])
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
        dimensions: Partial_Record_AuditAggregationDimension_string_nullSchema,
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

// Hand-authored, not converted: a query contract has no component BODY in the published document —
// the scanner expands it into `parameters` — so the converter has nothing to read. Written from the
// `AuditTrailQuery` declaration it replaces, whose fields `listEvents` reads one for one.
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
