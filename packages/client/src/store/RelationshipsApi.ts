import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    CreateRelationshipPayload,
    DeleteRelationshipQuery,
    FindRelationshipsPayload,
    FindRelationshipsResponse,
    ReconcileRelationshipsPayload,
    ReconcileRelationshipsResponse,
    Relationship,
    RelationshipValueHintsPayload,
    RelationshipValueHintsResponse,
    TraverseRelationshipsPayload,
    TraverseRelationshipsResponse,
    UpdateRelationshipPayload,
    UpsertRelationshipsPayload,
    UpsertRelationshipsResponse,
} from '@vertesia/common';
import { withIdempotencyKey } from '../idempotency-key.js';

export class RelationshipsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/relationships');
    }

    create(payload: CreateRelationshipPayload): Promise<Relationship> {
        return this.post('/', { payload: withIdempotencyKey(this.client, payload) });
    }

    retrieve(id: string): Promise<Relationship> {
        return this.get(`/${encodeURIComponent(id)}`);
    }

    update(id: string, payload: UpdateRelationshipPayload): Promise<Relationship> {
        return this.put(`/${encodeURIComponent(id)}`, { payload });
    }

    remove(id: string, query: DeleteRelationshipQuery): Promise<Relationship> {
        return this.del(`/${encodeURIComponent(id)}`, { query });
    }

    upsert(payload: UpsertRelationshipsPayload): Promise<UpsertRelationshipsResponse> {
        return this.post('/upsert', { payload });
    }

    find(payload: FindRelationshipsPayload): Promise<FindRelationshipsResponse> {
        return this.post('/find', { payload });
    }

    traverse(payload: TraverseRelationshipsPayload): Promise<TraverseRelationshipsResponse> {
        return this.post('/traverse', { payload });
    }

    reconcile(payload: ReconcileRelationshipsPayload): Promise<ReconcileRelationshipsResponse> {
        return this.post('/reconcile', { payload });
    }

    valueHints(payload: RelationshipValueHintsPayload): Promise<RelationshipValueHintsResponse> {
        return this.post('/value-hints', { payload });
    }
}
