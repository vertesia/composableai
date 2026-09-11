import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    CreateSubjectPayload,
    DeleteSubjectQuery,
    ResolveSubjectsPayload,
    ResolveSubjectsResponse,
    Subject,
    SubjectReadQuery,
    SubjectReadResponse,
    UpdateSubjectPayload,
    UpsertSubjectsPayload,
    UpsertSubjectsResponse,
} from '@vertesia/common';

export class SubjectsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/subjects');
    }

    create(payload: CreateSubjectPayload): Promise<Subject> {
        return this.post('/', { payload });
    }

    retrieve(id: string, query?: SubjectReadQuery): Promise<SubjectReadResponse> {
        return this.get(`/${encodeURIComponent(id)}`, { query });
    }

    update(id: string, payload: UpdateSubjectPayload): Promise<Subject> {
        return this.put(`/${encodeURIComponent(id)}`, { payload });
    }

    remove(id: string, query: DeleteSubjectQuery): Promise<Subject> {
        return this.del(`/${encodeURIComponent(id)}`, { query });
    }

    resolve(payload: ResolveSubjectsPayload): Promise<ResolveSubjectsResponse> {
        return this.post('/resolve', { payload });
    }

    upsert(payload: UpsertSubjectsPayload): Promise<UpsertSubjectsResponse> {
        return this.post('/upsert', { payload });
    }
}
