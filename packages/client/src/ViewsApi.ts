import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    CreateViewExperienceRequest,
    DeleteByIdResult,
    ExecuteViewRequest,
    PreviewViewExperienceRequest,
    UpdateViewExperienceRequest,
    ViewExecutionResult,
    ViewExperience,
    ViewExperienceListQuery,
} from '@vertesia/common';
import type { StoreViewsApi } from './store/ViewsApi.js';

export default class ViewsApi extends ApiTopic {
    constructor(
        parent: ClientBase,
        private readonly executionApi: StoreViewsApi,
    ) {
        super(parent, '/api/v1/views');
    }

    list(query: ViewExperienceListQuery = {}): Promise<ViewExperience[]> {
        return this.get('/', {
            query: {
                limit: query.limit,
                offset: query.offset,
            },
        });
    }

    create(payload: CreateViewExperienceRequest): Promise<ViewExperience> {
        return this.post('/', { payload });
    }

    retrieve(id: string): Promise<ViewExperience> {
        return this.get(`/${encodeURIComponent(id)}`);
    }

    update(id: string, payload: UpdateViewExperienceRequest): Promise<ViewExperience> {
        return this.put(`/${encodeURIComponent(id)}`, { payload });
    }

    delete(id: string): Promise<DeleteByIdResult> {
        return this.del(`/${encodeURIComponent(id)}`);
    }

    /**
     * Execute a persisted, built-in system, or app-contributed View through the content service.
     */
    execute(id: string, payload: ExecuteViewRequest = {}): Promise<ViewExecutionResult> {
        return this.executionApi.execute(id, payload);
    }

    /**
     * Validate and execute an unsaved View through the content service.
     */
    preview(payload: PreviewViewExperienceRequest): Promise<ViewExecutionResult> {
        return this.executionApi.preview(payload);
    }
}
