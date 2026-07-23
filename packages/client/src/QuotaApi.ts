import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type { QuotaStandingResponse, QuotaTierResponse } from '@vertesia/common';

export default class QuotaApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/quota');
    }

    /**
     * The calling tenant's own quota standing: effective API rate limits + current usage, plus
     * workflow-admission occupancy and an LLM-limiter posture note.
     */
    standing(): Promise<QuotaStandingResponse> {
        return this.get('/standing');
    }

    /**
     * The calling account's effective quota tier. A cheap, cacheable lookup used to resolve a
     * tenant's tier without a direct account-store dependency.
     */
    tier(): Promise<QuotaTierResponse> {
        return this.get('/tier');
    }
}
