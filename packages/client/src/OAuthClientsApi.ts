import { ApiTopic, ClientBase } from '@vertesia/api-fetch-client';
import type {
    CreateOAuthClientPayload,
    OAuthClient,
    OAuthClientCreateResponse,
    UpdateOAuthClientPayload,
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

    create(payload: CreateOAuthClientPayload): Promise<OAuthClientCreateResponse> {
        return this.post('/', { payload });
    }

    update(clientId: string, payload: UpdateOAuthClientPayload): Promise<OAuthClient> {
        return this.put(`/${clientId}`, { payload });
    }

    remove(clientId: string): Promise<{ success: true }> {
        return this.del(`/${clientId}`);
    }
}
