import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    CreateViewExperienceRequest,
    DeleteByIdResult,
    UpdateViewExperienceRequest,
    ViewExperience,
    ViewExperienceListQuery,
} from '@vertesia/common';

export default class ViewsApi extends ApiTopic {
    constructor(parent: ClientBase) {
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
}
