import type { z } from 'zod';
import type {
    AuditAggregationDetailFieldSchema,
    AuditAggregationDetailFilterSchema,
    AuditAggregationDistinctFieldSchema,
    AuditAggregationFilterSchema,
    AuditAggregationGroupSchema,
    AuditAggregationMetricSchema,
    AuditAggregationOperationSchema,
    AuditAggregationQuerySchema,
    AuditAggregationResolutionSchema,
    AuditAggregationResponseSchema,
    AuditAggregationRowSchema,
    AuditMeterSchema,
    AuditTrailEventSchema,
    AuditTrailQuerySchema,
    AuditTrailResponseSchema,
} from './api-schemas/audit-trail.js';

export const AUDIT_ACTIONS = [
    // CRUD operations
    'create',
    'update',
    'delete',
    'bulk_create',
    'bulk_change_type',
    'bulk_update',
    'bulk_delete',
    'attach',
    'detach',
    'credentials_fill',
    'credentials_totp_generation',
    'publish',
    'unpublish',
    // Billable operations
    'inference',
    'embedding',
    'image_generation',
    // Content processing outcomes
    'document_processed',
    // Interaction execution lifecycle (non-billable)
    'execution_run_created',
    'execution_run_completed',
    'intake_workflow_started',
    'intake_workflow_completed',
] as const;

// `AuditAction` is deliberately NOT inferred from `AuditActionSchema`: the schema is
// `KnownAuditAction | string`, which TypeScript collapses to `string`, losing the completion the
// `(string & {})` half of the union exists to preserve. The two agree on what they accept.
export type KnownAuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditAction = KnownAuditAction | (string & {});

/**
 * Generic metering entry attached to audit events.
 * Used for cost attribution, usage tracking, and billing.
 *
 * Examples:
 *   { category: "tokens", type: "input", quantity: 1234 }
 *   { category: "tokens", type: "output", quantity: 567 }
 *   { category: "compute", type: "duration_ms", quantity: 2100 }
 *   { category: "processing", type: "pages", quantity: 12 }
 */
export type AuditMeter = z.infer<typeof AuditMeterSchema>;

export type AuditTrailEvent = z.infer<typeof AuditTrailEventSchema>;

export type AuditTrailQuery = z.infer<typeof AuditTrailQuerySchema>;

export type AuditTrailResponse = z.infer<typeof AuditTrailResponseSchema>;

export const AUDIT_AGGREGATION_DIMENSIONS = [
    'time',
    'action',
    'resource_type',
    'event_category',
    'provider',
    'project_id',
    'details.pipeline',
    'details.verdict',
    'details.workflow_type',
    'details.rule_id',
    'model',
] as const;

export type AuditAggregationDimension = (typeof AUDIT_AGGREGATION_DIMENSIONS)[number];
export type AuditAggregationResolution = z.infer<typeof AuditAggregationResolutionSchema>;
export type AuditAggregationDetailField = z.infer<typeof AuditAggregationDetailFieldSchema>;
export type AuditAggregationOperation = z.infer<typeof AuditAggregationOperationSchema>;
export type AuditAggregationDistinctField = z.infer<typeof AuditAggregationDistinctFieldSchema>;

export type AuditAggregationGroup = z.infer<typeof AuditAggregationGroupSchema>;

export type AuditAggregationMetric = z.infer<typeof AuditAggregationMetricSchema>;

export type AuditAggregationDetailFilter = z.infer<typeof AuditAggregationDetailFilterSchema>;

export type AuditAggregationFilter = z.infer<typeof AuditAggregationFilterSchema>;

/**
 * Safe audit aggregation query. The server always applies the authenticated account scope and,
 * for project-scoped principals, replaces projectId with the authenticated project.
 */
export type AuditAggregationQuery = z.infer<typeof AuditAggregationQuerySchema>;

export type AuditAggregationRow = z.infer<typeof AuditAggregationRowSchema>;

export type AuditAggregationResponse = z.infer<typeof AuditAggregationResponseSchema>;

/** Billable audit actions for cost analytics queries */
export const BILLABLE_AUDIT_ACTIONS = ['inference', 'embedding', 'image_generation'] satisfies KnownAuditAction[];
