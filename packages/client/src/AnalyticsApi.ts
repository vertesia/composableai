import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    RunsAnalyticsFilterQuery,
    RunsAnalyticsSummary,
    RunTimeSeriesPoint,
    TokenUsageSummary,
} from '@vertesia/common';

export default class AnalyticsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/analytics');
    }

    private queryString(query?: RunsAnalyticsFilterQuery): string {
        const params = new URLSearchParams();
        if (query?.start) params.set('start', query.start);
        if (query?.end) params.set('end', query.end);
        if (query?.environment) params.set('environment', query.environment);
        if (query?.interaction) params.set('interaction', query.interaction);
        if (query?.status) params.set('status', query.status);
        if (query?.origin) params.set('origin', query.origin);
        const value = params.toString();
        return value ? `?${value}` : '';
    }

    runsSummary(query?: RunsAnalyticsFilterQuery): Promise<RunsAnalyticsSummary> {
        return this.get(`/runs/summary${this.queryString(query)}`);
    }

    runsTimeSeries(query?: RunsAnalyticsFilterQuery): Promise<RunTimeSeriesPoint[]> {
        return this.get(`/runs/time-series${this.queryString(query)}`);
    }

    runsTokenUsage(query?: RunsAnalyticsFilterQuery): Promise<TokenUsageSummary> {
        return this.get(`/runs/token-usage${this.queryString(query)}`);
    }
}
