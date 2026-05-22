import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    CostAnalyticsQuery,
    CostAnalyticsResponse,
    CostExportQuery,
    CostModelPricesQuery,
    CostRunPriceQuery,
    CostRunPriceResponse,
    ModelPriceComparisonResponse,
} from '@vertesia/common';

export class CostApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/cost');
    }

    /**
     * Get cost analytics for the current project.
     * Returns cost breakdown by model/environment with pricing from billing export.
     * Covers all inference types: direct, agent, embedding.
     */
    getAnalytics(
        query: CostAnalyticsQuery = {}
    ): Promise<CostAnalyticsResponse> {
        return this.post('/analytics', { payload: query });
    }

    /**
     * Get platform-wide cost analytics across all customers.
     * Requires Vertesia staff privileges. Defaults to group_by='account'.
     */
    getGlobalAnalytics(
        query: CostAnalyticsQuery = {}
    ): Promise<CostAnalyticsResponse> {
        return this.post('/analytics/global', { payload: query });
    }

    /**
     * Get current list prices and effective prices for the selected period.
     */
    getModelPrices(
        query: CostModelPricesQuery = {}
    ): Promise<ModelPriceComparisonResponse> {
        return this.get('/model-prices', { query: { ...query } });
    }

    /**
     * Price a single interaction run or agent run.
     */
    getRunPrice(
        query: CostRunPriceQuery
    ): Promise<CostRunPriceResponse> {
        return this.post('/run-price', { payload: query });
    }

    /**
     * Price a run and include the full model pricing catalog for comparison.
     */
    getRunPriceComparison(
        query: CostRunPriceQuery
    ): Promise<CostRunPriceResponse> {
        return this.post('/run-price', { payload: { ...query, include_comparison_pricing: true } });
    }

    /**
     * Get the CSV export URL for raw inference audit events.
     */
    getExportUrl(params?: CostExportQuery): string {
        const searchParams = new URLSearchParams();
        if (params?.from) searchParams.set('from', typeof params.from === 'number' ? new Date(params.from).toISOString() : params.from);
        if (params?.to) searchParams.set('to', typeof params.to === 'number' ? new Date(params.to).toISOString() : params.to);
        if (params?.scope) searchParams.set('scope', params.scope);
        if (params?.project_id) searchParams.set('project_id', params.project_id);
        if (params?.workflow_id) searchParams.set('workflow_id', params.workflow_id);
        const qs = searchParams.toString();
        return `${this.baseUrl}/export${qs ? `?${qs}` : ''}`;
    }
}
