import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type { CreateDelegationGrantPayload, DelegationGrant } from '@vertesia/common';
export default class DelegationGrantsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/iam/delegation-grants');
    }
    create(payload: CreateDelegationGrantPayload): Promise<DelegationGrant> {
        return this.post('', { payload });
    }
    list(): Promise<DelegationGrant[]> {
        return this.get('');
    }
    mine(): Promise<DelegationGrant[]> {
        return this.get('/me');
    }
    retrieve(id: string): Promise<DelegationGrant> {
        return this.get(`/${id}`);
    }
    revoke(id: string): Promise<DelegationGrant> {
        return this.post(`/${id}/revoke`);
    }
}
