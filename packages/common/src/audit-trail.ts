import type * as Wire from './wire-types.generated.js';

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
export type AuditMeter = Wire.AuditMeter;

export type AuditTrailEvent = Wire.AuditTrailEvent;

export type AuditTrailQuery = Wire.AuditTrailQuery;

export type AuditTrailResponse = Wire.AuditTrailResponse;

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
export type AuditAggregationResolution = Wire.AuditAggregationResolution;
export type AuditAggregationDetailField = Wire.AuditAggregationDetailField;
export type AuditAggregationOperation = Wire.AuditAggregationOperation;
export type AuditAggregationDistinctField = Wire.AuditAggregationDistinctField;

export type AuditAggregationGroup = Wire.AuditAggregationGroup;

export type AuditAggregationMetric = Wire.AuditAggregationMetric;

export type AuditAggregationDetailFilter = Wire.AuditAggregationDetailFilter;

export type AuditAggregationFilter = Wire.AuditAggregationFilter;

/**
 * Safe audit aggregation query. The server always applies the authenticated account scope and,
 * for project-scoped principals, replaces projectId with the authenticated project.
 */
export type AuditAggregationQuery = Wire.AuditAggregationQuery;

export type AuditAggregationRow = Wire.AuditAggregationRow;

export type AuditAggregationResponse = Wire.AuditAggregationResponse;

/** Billable audit actions for cost analytics queries */
export const BILLABLE_AUDIT_ACTIONS = ['inference', 'embedding', 'image_generation'] satisfies KnownAuditAction[];
