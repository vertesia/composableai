import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    AuthorizeRemoteMcpConnectionQuery,
    McpOAuthConnectResponse,
    McpOAuthDisconnectResponse,
    McpOAuthExchangePayload,
    McpOAuthTokenRequest,
    McpOAuthTokenResponse,
    OAuthAuthorizeResponse,
    OAuthAuthStatus,
    OAuthMetadataResponse,
    ReportMcpStepUpOutcomeRequest,
    ReportMcpStepUpOutcomeResponse,
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

    /**
     * @param stepUp After the server refused a tool call with `insufficient_scope`: the scope to ask for as well. A
     * server older than these parameters ignores them and authorizes the connection as before.
     */
    authorize(
        appInstallId: string,
        collectionId: string,
        stepUp?: AuthorizeRemoteMcpConnectionQuery,
    ): Promise<OAuthAuthorizeResponse> {
        const query = stepUp?.required_scope ? stepUp : undefined;
        return this.get(`/authorize/${appInstallId}/${collectionId}`, query ? { query } : undefined);
    }

    /**
     * Report what became of the step-up recorded on the caller's grant: `used` forgets it, `refused_again` records
     * that the server still refused the scope. Called by workflow workers; a server older than this operation
     * answers 404.
     */
    reportStepUpOutcome(payload: ReportMcpStepUpOutcomeRequest): Promise<ReportMcpStepUpOutcomeResponse> {
        return this.post('/step-up/outcome', { payload });
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
