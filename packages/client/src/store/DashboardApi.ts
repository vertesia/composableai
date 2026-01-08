import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import {
    CreateDashboardPayload,
    Dashboard,
    DashboardItem,
    DashboardStatus,
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
    constructor(parent: ClientBase, storeId: string) {
        super(parent, `/api/v1/data/${storeId}/dashboards`);
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
        return this.get(`/${query}`);
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
        return this.post("/", { payload });
    }

    /**
     * Get a dashboard by ID.
     *
     * @param id - Dashboard ID
     * @returns The dashboard with all details
     */
    retrieve(id: string): Promise<Dashboard> {
        return this.get(`/${id}`);
    }

    /**
     * Update an existing dashboard.
     *
     * @param id - Dashboard ID
     * @param payload - Fields to update
     * @returns The updated dashboard
     */
    update(id: string, payload: UpdateDashboardPayload): Promise<Dashboard> {
        return this.put(`/${id}`, { payload });
    }

    /**
     * Archive (soft delete) a dashboard.
     *
     * @param id - Dashboard ID
     * @returns Object with the archived dashboard ID
     */
    delete(id: string): Promise<{ id: string; status: DashboardStatus }> {
        return this.del(`/${id}`);
    }
}
