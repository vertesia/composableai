export type AuditAction =
    // CRUD operations
    | 'create'
    | 'update'
    | 'delete'
    | 'bulk_create'
    | 'bulk_update'
    | 'bulk_delete'
    | 'attach'
    | 'detach'
    | 'publish'
    | 'unpublish'
    // Billable operations
    | 'inference'
    | 'embedding'
    | 'image_generation';

/** Billable audit actions for cost analytics queries */
export const BILLABLE_AUDIT_ACTIONS: AuditAction[] = [
    'inference',
    'embedding',
    'image_generation',
];

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
export interface AuditMeter {
    category: string;
    type: string;
    quantity: number;
}

export interface AuditTrailEvent {
    event_type: 'audit';
    action: AuditAction;
    resource_type: string;
    resource_id: string;
    timestamp: string;
    request_id: string;
    status: number;
    success: boolean;
    principal_id: string | null;
    principal_type: string | null;
    effective_principal_id: string | null;
    roles: string[];
    account_id: string | null;
    project_id: string | null;
    tenant_id: string | null;
    account_name: string | null;
    project_name: string | null;
    /** Generic metering data for cost attribution and usage tracking */
    meters?: AuditMeter[];
    /** Event-specific metadata — shape varies by action/resource_type */
    details?: Record<string, unknown>;
}

export interface AuditTrailQuery {
    /** Filter by action types */
    actions?: AuditAction[];
    /** Filter by resource types */
    resourceTypes?: string[];
    /** Filter by resource ID */
    resourceId?: string;
    /** Filter by exact actor principal ref (matches principal_id column). */
    principalId?: string;
    /** Filter by top-level actor category (matches principal_type column). */
    principalType?: string;
    /** Filter by delegated/direct effective principal ref (matches effective_principal_id column). */
    effectivePrincipalId?: string;
    /** Filter by whether an event has an effective principal ref. */
    hasEffectivePrincipal?: boolean;
    /** Filter by project ID */
    projectId?: string;
    /** Start time (ISO string) */
    from?: string;
    /** End time (ISO string) */
    to?: string;
    /** Pagination: number of items to return (default 50, max 200) */
    limit?: number;
    /** Pagination: offset */
    offset?: number;
}

export interface AuditTrailResponse {
    events: AuditTrailEvent[];
    /** Whether there are more events after this page */
    hasNext: boolean;
    limit: number;
    offset: number;
}
