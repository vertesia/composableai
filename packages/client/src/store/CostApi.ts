import { ApiTopic, ClientBase } from '@vertesia/api-fetch-client';
import { CostAnalyticsQuery, CostAnalyticsResponse } from '@vertesia/common';

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
}
