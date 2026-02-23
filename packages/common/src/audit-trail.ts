export type AuditAction =
    | 'create'
    | 'update'
    | 'delete'
    | 'bulk_update'
    | 'bulk_delete'
    | 'attach'
    | 'detach'
    | 'publish'
    | 'unpublish';

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
    principal_user_id: string | null;
    roles: string[];
    account_id: string | null;
    project_id: string | null;
    tenant_id: string | null;
    account_name: string | null;
    project_name: string | null;
}

export interface AuditTrailQuery {
    /** Filter by action types */
    actions?: AuditAction[];
    /** Filter by resource types */
    resourceTypes?: string[];
    /** Filter by resource ID */
    resourceId?: string;
    /** Filter by principal ID (matches principal_id column — API keys, service accounts) */
    principalId?: string;
    /** Filter by principal user ID (matches principal_user_id column — human users) */
    principalUserId?: string;
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
