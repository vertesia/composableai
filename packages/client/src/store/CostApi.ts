import { ApiTopic, ClientBase } from '@vertesia/api-fetch-client';
import { CostAnalyticsQuery, CostAnalyticsResponse, CostRunPriceQuery, CostRunPriceResponse, ModelPriceComparisonResponse } from '@vertesia/common';

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
        query: Pick<CostAnalyticsQuery, 'from' | 'to'> = {}
    ): Promise<ModelPriceComparisonResponse> {
        return this.get('/model-prices', { query });
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
     * Get the CSV export URL for raw inference audit events.
     */
    getExportUrl(params?: { from?: string | number; to?: string | number }): string {
        const searchParams = new URLSearchParams();
        if (params?.from) searchParams.set('from', typeof params.from === 'number' ? new Date(params.from).toISOString() : params.from);
        if (params?.to) searchParams.set('to', typeof params.to === 'number' ? new Date(params.to).toISOString() : params.to);
        const qs = searchParams.toString();
        return `${this.baseUrl}/export${qs ? `?${qs}` : ''}`;
    }
}
