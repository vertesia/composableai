import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import { DateRangeQuery, RunAnalyticsQuery, RunAnalyticsResult, RunsAnalyticsSummary, TokenUsageSummary } from "@vertesia/common";

export default class AnalyticsApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/api/v1/analytics")
    }

    runs(params: RunAnalyticsQuery): Promise<RunAnalyticsResult[]> {
        return this.post('/runs', { payload: params });
    }

    runsSummary(query?: DateRangeQuery): Promise<RunsAnalyticsSummary> {
        const params = new URLSearchParams();
        if (query?.start) params.set('start', query.start);
        if (query?.end) params.set('end', query.end);
        const qs = params.toString();
        return this.get('/runs/summary' + (qs ? '?' + qs : ''));
    }

    runsTimeSeries(query?: DateRangeQuery): Promise<Array<{ timestamp: Date; count: number }>> {
        const params = new URLSearchParams();
        if (query?.start) params.set('start', query.start);
        if (query?.end) params.set('end', query.end);
        const qs = params.toString();
        return this.get('/runs/time-series' + (qs ? '?' + qs : ''));
    }

    runsTokenUsage(query?: DateRangeQuery): Promise<TokenUsageSummary> {
        const params = new URLSearchParams();
        if (query?.start) params.set('start', query.start);
        if (query?.end) params.set('end', query.end);
        const qs = params.toString();
        return this.get('/runs/token-usage' + (qs ? '?' + qs : ''));
    }

}
