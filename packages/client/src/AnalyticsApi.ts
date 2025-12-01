import { RunAnalyticsQuery, RunAnalyticsResult, RunsAnalyticsSummary } from "@vertesia/common";
import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";




export default class AnalyticsApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/api/v1/analytics")
    }

    runs(params: RunAnalyticsQuery): Promise<RunAnalyticsResult[]> {
        return this.post('/runs', { payload: params });
    }
    
    //Unstable, likely to change - last update 1st Dec 2025
    runsSummary(): Promise<RunsAnalyticsSummary> {
        return this.get('/runs/summary');
    }

}
