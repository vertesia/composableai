import { ApiTopic, ClientBase } from '@vertesia/api-fetch-client';
import type {
    CreateOAuthApplicationPayload,
    OAuthAppAuthStatus,
    OAuthAppAuthorizeResponse,
    OAuthApplication,
    UpdateOAuthApplicationPayload,
} from '@vertesia/common';

export default class OAuthAppsApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, '/api/v1/oauth-apps');
    }

    /**
     * List all OAuth applications in the current project.
     */
    list(): Promise<OAuthApplication[]> {
        return this.get('/');
    }

    /**
     * Get a single OAuth application by ID (secret redacted).
     */
    retrieve(id: string): Promise<OAuthApplication> {
        return this.get(`/${id}`);
    }

    /**
     * Create a new OAuth application.
     */
    create(payload: CreateOAuthApplicationPayload): Promise<OAuthApplication> {
        return this.post('/', { payload });
    }

    /**
     * Update an OAuth application.
     */
    update(id: string, payload: UpdateOAuthApplicationPayload): Promise<OAuthApplication> {
        return this.put(`/${id}`, { payload });
    }

    /**
     * Delete an OAuth application.
     */
    remove(id: string): Promise<void> {
        return this.del(`/${id}`);
    }

    /**
     * Initiate OAuth 2.0 authorization flow for the current user.
     * Returns an authorization URL to open in a popup/browser.
     */
    authorize(id: string): Promise<OAuthAppAuthorizeResponse> {
        return this.get(`/${id}/authorize`);
    }

    /**
     * Exchange an authorization code for tokens (called by UI callback).
     */
    exchange(code: string, state: string): Promise<{ success: boolean }> {
        return this.post('/exchange', { payload: { code, state } });
    }

    /**
     * Check the current user's authentication status for an OAuth application.
     */
    getStatus(id: string): Promise<OAuthAppAuthStatus> {
        return this.get(`/${id}/status`);
    }

    /**
     * Get a valid access token for an OAuth application (auto-refreshes).
     * Primarily used by workflows/activities.
     */
    getToken(id: string): Promise<{ access_token: string }> {
        return this.post(`/${id}/token`, { payload: {} });
    }

    /**
     * Delete the current user's tokens for an OAuth application.
     */
    disconnect(id: string): Promise<void> {
        return this.del(`/${id}/disconnect`);
    }
}
