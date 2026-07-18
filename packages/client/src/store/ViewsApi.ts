import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type { ExecuteViewRequest, ViewExecutionResult } from '@vertesia/common';

export class StoreViewsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/views');
    }

    execute(id: string, payload: ExecuteViewRequest = {}): Promise<ViewExecutionResult> {
        return this.post(`/${encodeURIComponent(id)}/execute`, { payload });
    }
}
