import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import {
    CreateDashboardPayload,
    CreateDashboardSnapshotPayload,
    Dashboard,
    DashboardItem,
    DashboardStatus,
    DashboardVersion,
    DashboardVersionItem,
    DataStoreApiHeaders,
    PromoteDashboardVersionPayload,
    UpdateDashboardPayload,
} from "@vertesia/common";

/**
 * Client API for managing Vega-based dashboards linked to data stores.
 *
 * Dashboards provide:
 * - Multi-panel Vega/Vega-Lite visualizations
 * - SQL-backed data sources via named queries
 *
 * Note: Rendering is handled by the tools (data_preview_dashboard, data_render_dashboard).
 */
export class DashboardApi extends ApiTopic {
    private readonly storeId: string;

    constructor(parent: ClientBase, storeId: string) {
        super(parent, `/api/v1/data/${storeId}/dashboards`);
        this.storeId = storeId;
    }

    /**
     * Create headers with data store ID for Cloud Run session affinity.
     */
    private storeHeaders(): Record<string, string> {
        return { [DataStoreApiHeaders.DATA_STORE_ID]: this.storeId };
    }

    // ============================================================
    // Dashboard Operations
    // ============================================================

    /**
     * List all dashboards for the data store.
     *
     * @param status - Filter by status (default: 'active')
     * @returns List of dashboards
     */
    list(status?: DashboardStatus): Promise<DashboardItem[]> {
        const query = status ? `?status=${status}` : '';
        return this.get(`/${query}`, { headers: this.storeHeaders() });
    }

    /**
     * Create a new dashboard.
     *
     * @param payload - Dashboard configuration with queries and panels
     * @returns The created dashboard
     *
     * @example
     * ```typescript
     * const dashboard = await client.data.dashboards(storeId).create({
     *   name: 'Sales Overview',
     *   queries: [
     *     { name: 'revenue', sql: 'SELECT month, SUM(amount) FROM sales GROUP BY month' }
     *   ],
     *   panels: [
     *     {
     *       title: 'Monthly Revenue',
     *       dataSources: ['revenue'],
     *       position: { row: 0, col: 0 },
     *       spec: {
     *         mark: 'bar',
     *         encoding: {
     *           x: { field: 'month', type: 'ordinal' },
     *           y: { field: 'sum_amount', type: 'quantitative' }
     *         }
     *       }
     *     }
     *   ]
     * });
     * ```
     */
    create(payload: CreateDashboardPayload): Promise<Dashboard> {
        return this.post("/", { payload, headers: this.storeHeaders() });
    }

    /**
     * Get a dashboard by ID.
     *
     * @param id - Dashboard ID
     * @returns The dashboard with all details
     */
    retrieve(id: string): Promise<Dashboard> {
        return this.get(`/${id}`, { headers: this.storeHeaders() });
    }

    /**
     * Update an existing dashboard.
     *
     * @param id - Dashboard ID
     * @param payload - Fields to update
     * @returns The updated dashboard
     */
    update(id: string, payload: UpdateDashboardPayload): Promise<Dashboard> {
        return this.put(`/${id}`, { payload, headers: this.storeHeaders() });
    }

    /**
     * Archive (soft delete) a dashboard.
     *
     * @param id - Dashboard ID
     * @returns Object with the archived dashboard ID
     */
    delete(id: string): Promise<{ id: string; status: DashboardStatus }> {
        return this.del(`/${id}`, { headers: this.storeHeaders() });
    }

    // ============================================================
    // Version Operations
    // ============================================================

    /**
     * List versions for a dashboard.
     *
     * @param dashboardId - Dashboard ID
     * @param options - Filter options
     * @returns List of version summaries
     */
    listVersions(
        dashboardId: string,
        options?: { snapshotsOnly?: boolean; limit?: number }
    ): Promise<DashboardVersionItem[]> {
        const params = new URLSearchParams();
        if (options?.snapshotsOnly) params.set('snapshots_only', 'true');
        if (options?.limit) params.set('limit', String(options.limit));
        const query = params.toString() ? `?${params}` : '';
        return this.get(`/${dashboardId}/versions${query}`, { headers: this.storeHeaders() });
    }

    /**
     * Get a specific version with full content.
     *
     * @param dashboardId - Dashboard ID
     * @param versionId - Version ID
     * @returns The version with full content
     */
    getVersion(dashboardId: string, versionId: string): Promise<DashboardVersion> {
        return this.get(`/${dashboardId}/versions/${versionId}`, { headers: this.storeHeaders() });
    }

    /**
     * Create a named snapshot from current dashboard state.
     *
     * @param dashboardId - Dashboard ID
     * @param payload - Snapshot name and message
     * @returns The created snapshot version
     */
    createSnapshot(
        dashboardId: string,
        payload: CreateDashboardSnapshotPayload
    ): Promise<DashboardVersionItem> {
        return this.post(`/${dashboardId}/versions`, { payload, headers: this.storeHeaders() });
    }

    /**
     * Promote a version to be the current/active one.
     * This restores the version's content to the dashboard.
     *
     * @param dashboardId - Dashboard ID
     * @param versionId - Version ID to promote
     * @param payload - Optional promotion message
     * @returns The updated dashboard
     */
    promoteVersion(
        dashboardId: string,
        versionId: string,
        payload?: PromoteDashboardVersionPayload
    ): Promise<Dashboard> {
        return this.post(`/${dashboardId}/versions/${versionId}/promote`, { payload: payload || {}, headers: this.storeHeaders() });
    }

    /**
     * Enable or disable versioning for a dashboard.
     *
     * @param dashboardId - Dashboard ID
     * @param enabled - Whether versioning should be enabled
     * @returns The updated versioning state
     */
    setVersioningEnabled(
        dashboardId: string,
        enabled: boolean
    ): Promise<{ versioning_enabled: boolean }> {
        return this.put(`/${dashboardId}/versioning`, { payload: { enabled }, headers: this.storeHeaders() });
    }
}
