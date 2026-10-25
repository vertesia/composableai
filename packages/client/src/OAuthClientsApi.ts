import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    CreateOAuthClientPayload,
    OAuthClient,
    OAuthClientCreateResponse,
    OAuthClientScopeMetadata,
    SuccessResponse,
    UpdateOAuthClientPayload,
    UpdateOAuthClientStatusPayload,
} from '@vertesia/common';

export default class OAuthClientsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/oauth-clients');
    }

    list(): Promise<OAuthClient[]> {
        return this.get('/');
    }

    retrieve(clientId: string): Promise<OAuthClient> {
        return this.get(`/${clientId}`);
    }

    scopeMetadata(): Promise<OAuthClientScopeMetadata> {
        return this.get('/scope-metadata');
    }

    create(payload: CreateOAuthClientPayload): Promise<OAuthClientCreateResponse> {
        return this.post('/', { payload });
    }

    update(clientId: string, payload: UpdateOAuthClientPayload): Promise<OAuthClient> {
        return this.put(`/${clientId}`, { payload });
    }

    /** Enable or disable sign-in without changing application-managed configuration. */
    setStatus(clientId: string, payload: UpdateOAuthClientStatusPayload): Promise<OAuthClient> {
        return this.put(`/${encodeURIComponent(clientId)}/status`, { payload });
    }

    remove(clientId: string): Promise<SuccessResponse> {
        return this.del(`/${clientId}`);
    }
}
