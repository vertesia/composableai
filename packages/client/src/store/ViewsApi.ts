import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type { ExecuteViewRequest, PreviewViewExperienceRequest, ViewExecutionResult } from '@vertesia/common';

export class StoreViewsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/view-executions');
    }

    execute(id: string, payload: ExecuteViewRequest = {}): Promise<ViewExecutionResult> {
        return this.post(`/${encodeURIComponent(id)}/execute`, { payload });
    }

    /**
     * Validate and execute an unsaved View configuration without persisting it.
     * Returns the same normalized results as {@link execute}.
     */
    preview(payload: PreviewViewExperienceRequest): Promise<ViewExecutionResult> {
        return this.post('/preview', { payload });
    }
}
