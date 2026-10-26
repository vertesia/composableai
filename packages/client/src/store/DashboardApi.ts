import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import {
    type CreateDashboardPayload,
    type CreateDashboardSnapshotPayload,
    type Dashboard,
    type DashboardArchiveResult,
    type DashboardBulkArchiveResult,
    type DashboardBulkDeleteResult,
    type DashboardExport,
    DashboardExportStatus,
    type DashboardItem,
    type DashboardStatus,
    type DashboardVersion,
    type DashboardVersionItem,
    type DashboardVersioningStatusResponse,
    DataStoreApiHeaders,
    type ExportDashboardPayload,
    type ExportDashboardPreviewPayload,
    type PromoteDashboardVersionPayload,
    type UpdateDashboardPayload,
} from '@vertesia/common';

/**
 * Client API for managing Vega-based dashboards linked to data stores.
 *
 * Dashboards provide:
 * - Multi-panel Vega/Vega-Lite visualizations
 * - SQL-backed data sources via named queries
 *
 * - PNG export of a saved dashboard ({@link DashboardApi.export}) or of an unsaved one
 *   ({@link DashboardApi.exportPreview}). Exports run in the background: poll them with
 *   {@link DashboardApi.getExport}, or wait for them with {@link DashboardApi.waitForExport}.
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
        return this.post('/', { payload, headers: this.storeHeaders() });
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
     * Start rendering a saved dashboard as an image.
     *
     * Every call renders a new image from the current data. The export starts `running`: poll it
     * with {@link getExport} or wait for it with {@link waitForExport}.
     *
     * @param id - Dashboard ID
     * @param payload - Parameter values and render options
     * @returns The started export
     */
    export(id: string, payload: ExportDashboardPayload = {}): Promise<DashboardExport> {
        return this.post(`/${id}/export`, { payload, headers: this.storeHeaders() });
    }

    /**
     * Start rendering an unsaved dashboard (SQL query and Vega-Lite spec) as an image, without saving it.
     *
     * Use it to check a spec before creating or updating a dashboard: an invalid spec or query makes
     * the export fail with the list of problems.
     *
     * @param payload - The query, spec and render options
     * @returns The started export
     */
    exportPreview(payload: ExportDashboardPreviewPayload): Promise<DashboardExport> {
        return this.post('/export', { payload, headers: this.storeHeaders() });
    }

    /**
     * Get the status of an export. Once it is `completed`, each call returns a fresh download URL.
     *
     * @param exportId - The `export_id` returned when the export was started
     * @returns The export
     */
    getExport(exportId: string): Promise<DashboardExport> {
        return this.get(`/exports/${exportId}`, { headers: this.storeHeaders() });
    }

    /**
     * Record that the dashboard has just been rendered, without editing it. The export activity calls
     * it once the image is uploaded; other callers have no reason to.
     *
     * @internal
     * @param id - Dashboard ID
     */
    async markRendered(id: string): Promise<void> {
        await this.post(`/${id}/rendered`, { headers: this.storeHeaders() });
    }

    /**
     * Poll an export until it is `completed` or `failed`.
     *
     * @param exportId - The `export_id` returned when the export was started
     * @param options - Poll interval (default: 1s) and timeout (default: 5 minutes)
     * @returns The completed or failed export
     * @throws Error when the export is still running after `timeoutMs`
     */
    async waitForExport(exportId: string, options: DashboardExportWaitOptions = {}): Promise<DashboardExport> {
        const pollIntervalMs = options.pollIntervalMs ?? 1000;
        const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
        const deadline = Date.now() + timeoutMs;
        while (true) {
            const current = await this.getExport(exportId);
            if (current.status !== DashboardExportStatus.RUNNING) {
                return current;
            }
            if (Date.now() >= deadline) {
                throw new Error(`Dashboard export ${exportId} is still running after ${timeoutMs}ms`);
            }
            await sleep(pollIntervalMs);
        }
    }

    /**
     * Archive (soft delete) a dashboard.
     *
     * @param id - Dashboard ID
     * @returns Object with the archived dashboard ID
     */
    delete(id: string): Promise<DashboardArchiveResult> {
        return this.del(`/${id}`, { headers: this.storeHeaders() });
    }

    /**
     * Archive (soft delete) multiple dashboards.
     *
     * @param ids - Array of dashboard IDs
     * @returns Object with counts of archived and failed dashboards
     */
    bulkArchive(ids: string[]): Promise<DashboardBulkArchiveResult> {
        return this.post('/bulk/archive', { payload: { ids }, headers: this.storeHeaders() });
    }

    /**
     * Permanently delete multiple dashboards.
     *
     * @param ids - Array of dashboard IDs
     * @returns Object with counts of deleted and failed dashboards
     */
    bulkDelete(ids: string[]): Promise<DashboardBulkDeleteResult> {
        return this.post('/bulk/delete', { payload: { ids }, headers: this.storeHeaders() });
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
        options?: { snapshotsOnly?: boolean; limit?: number },
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
    createSnapshot(dashboardId: string, payload: CreateDashboardSnapshotPayload): Promise<DashboardVersionItem> {
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
        payload?: PromoteDashboardVersionPayload,
    ): Promise<Dashboard> {
        return this.post(`/${dashboardId}/versions/${versionId}/promote`, {
            payload: payload || {},
            headers: this.storeHeaders(),
        });
    }

    /**
     * Enable or disable versioning for a dashboard.
     *
     * @param dashboardId - Dashboard ID
     * @param enabled - Whether versioning should be enabled
     * @returns The updated versioning state
     */
    setVersioningEnabled(dashboardId: string, enabled: boolean): Promise<DashboardVersioningStatusResponse> {
        return this.put(`/${dashboardId}/versioning`, { payload: { enabled }, headers: this.storeHeaders() });
    }
}

/**
 * Options for {@link DashboardApi.waitForExport}.
 */
export interface DashboardExportWaitOptions {
    /** Delay between status checks, in milliseconds (default: 1000) */
    pollIntervalMs?: number;
    /** How long to wait before giving up, in milliseconds (default: 5 minutes) */
    timeoutMs?: number;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
