import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    CreateOAuthProviderPayload,
    OAuthProviderAccessTokenResponse,
    OAuthProvider,
    OAuthProviderAuthStatus,
    OAuthProviderAuthorizeResponse,
    SuccessResponse,
    UpdateOAuthProviderPayload,
} from '@vertesia/common';

export default class OAuthProvidersApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, '/api/v1/oauth-providers');
    }

    list(): Promise<OAuthProvider[]> {
        return this.get('/');
    }

    retrieve(id: string): Promise<OAuthProvider> {
        return this.get(`/${id}`);
    }

    create(payload: CreateOAuthProviderPayload): Promise<OAuthProvider> {
        return this.post('/', { payload });
    }

    update(id: string, payload: UpdateOAuthProviderPayload): Promise<OAuthProvider> {
        return this.put(`/${id}`, { payload });
    }

    remove(id: string): Promise<void> {
        return this.del(`/${id}`);
    }

    authorize(id: string): Promise<OAuthProviderAuthorizeResponse> {
        return this.get(`/${id}/authorize`);
    }

    exchange(code: string, state: string): Promise<SuccessResponse> {
        return this.post('/exchange', { payload: { code, state } });
    }

    getStatus(id: string): Promise<OAuthProviderAuthStatus> {
        return this.get(`/${id}/status`);
    }

    connect(id: string): Promise<SuccessResponse> {
        return this.post(`/${id}/connect`, { payload: {} });
    }

    getToken(id: string): Promise<OAuthProviderAccessTokenResponse> {
        return this.post(`/${id}/token`, { payload: {} });
    }

    disconnect(id: string): Promise<SuccessResponse> {
        return this.del(`/${id}/disconnect`);
    }
}
