import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    McpOAuthConnectResponse,
    McpOAuthDisconnectResponse,
    McpOAuthExchangePayload,
    McpOAuthTokenRequest,
    McpOAuthTokenResponse,
    OAuthAuthorizeResponse,
    OAuthAuthStatus,
    OAuthMetadataResponse,
} from '@vertesia/common';

export default class RemoteMcpConnectionsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/remote-mcp-connections');
    }

    getStatus(appInstallId: string): Promise<OAuthAuthStatus[]> {
        return this.get(`/status/${appInstallId}`);
    }

    getCollectionStatus(appInstallId: string, collectionId: string): Promise<OAuthAuthStatus> {
        return this.get(`/status/${appInstallId}/${collectionId}`);
    }

    getMetadata(appInstallId: string, collectionId: string): Promise<OAuthMetadataResponse> {
        return this.get(`/metadata/${appInstallId}/${collectionId}`);
    }

    authorize(appInstallId: string, collectionId: string): Promise<OAuthAuthorizeResponse> {
        return this.get(`/authorize/${appInstallId}/${collectionId}`);
    }

    /**
     * @param iss The `iss` parameter of the authorization response (RFC 9207), when the callback has one. A server
     * older than this parameter rejects a request that carries it.
     */
    exchange(code: string, state: string, iss?: string): Promise<McpOAuthConnectResponse> {
        return this.post('/exchange', {
            payload: { code, state, ...(iss ? { iss } : {}) } satisfies McpOAuthExchangePayload,
        });
    }

    connect(appInstallId: string, collectionId: string): Promise<McpOAuthConnectResponse> {
        return this.post(`/connect/${appInstallId}/${collectionId}`, {});
    }

    disconnect(appInstallId: string, collectionId: string): Promise<McpOAuthDisconnectResponse> {
        return this.del(`/disconnect/${appInstallId}/${collectionId}`);
    }

    getCollectionToken(appInstallId: string, collectionId: string): Promise<McpOAuthTokenResponse> {
        return this.post('/token', {
            payload: { app_install_id: appInstallId, collection_id: collectionId } satisfies McpOAuthTokenRequest,
        });
    }

    getToken(mcpServerUrl: string): Promise<McpOAuthTokenResponse> {
        return this.post('/token', {
            payload: { mcp_server_url: mcpServerUrl } satisfies McpOAuthTokenRequest,
        });
    }
}
