import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type { OidcFederationConnection, OidcFederationConnectionPayload, SuccessResponse } from '@vertesia/common';

export default class OidcFederationApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/oidc-federation');
    }
    retrieve(id: string): Promise<OidcFederationConnection> {
        return this.get(`/${encodeURIComponent(id)}`);
    }
    list(): Promise<OidcFederationConnection[]> {
        return this.get('/');
    }
    create(payload: OidcFederationConnectionPayload): Promise<OidcFederationConnection> {
        return this.post('/', { payload });
    }
    update(id: string, payload: OidcFederationConnectionPayload): Promise<OidcFederationConnection> {
        return this.put(`/${encodeURIComponent(id)}`, { payload });
    }
    remove(id: string): Promise<SuccessResponse> {
        return this.del(`/${encodeURIComponent(id)}`);
    }
}
