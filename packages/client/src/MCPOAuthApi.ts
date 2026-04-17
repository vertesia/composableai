import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import type {
    McpOAuthConnectResponse,
    McpOAuthDisconnectResponse,
    McpOAuthTokenRequest,
    McpOAuthTokenResponse,
    OAuthAuthStatus,
    OAuthAuthorizeResponse,
    OAuthMetadataResponse
} from "@vertesia/common";

export default class MCPOAuthApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/api/v1/mcp/oauth")
    }

    /**
     * Get OAuth authentication status for all collections in an app installation
     * @param appInstallId - The app installation ID
     * @returns Array of OAuth authentication statuses
     */
    getStatus(appInstallId: string): Promise<OAuthAuthStatus[]> {
        return this.get(`/status/${appInstallId}`);
    }

    /**
     * Get OAuth authentication status for a specific collection
     * @param appInstallId - The app installation ID
     * @param collectionId - The stable collection id
     * @returns OAuth authentication status for the collection
     */
    getCollectionStatus(appInstallId: string, collectionId: string): Promise<OAuthAuthStatus> {
        return this.get(`/status/${appInstallId}/${collectionId}`);
    }

    /**
     * Get OAuth metadata for a specific collection
     * @param appInstallId - The app installation ID
     * @param collectionId - The stable collection id
     * @returns OAuth metadata
     */
    getMetadata(appInstallId: string, collectionId: string): Promise<OAuthMetadataResponse> {
        return this.get(`/metadata/${appInstallId}/${collectionId}`);
    }

    /**
     * Initiate OAuth authorization flow for a specific collection
     * @param appInstallId - The app installation ID
     * @param collectionId - The stable collection id
     * @returns Authorization URL to open for user authentication
     */
    authorize(appInstallId: string, collectionId: string): Promise<OAuthAuthorizeResponse> {
        return this.get(`/authorize/${appInstallId}/${collectionId}`);
    }

    /**
     * Connect a client_credentials OAuth Application to an MCP collection.
     * Discovers and backfills the token endpoint if not configured, then verifies credentials.
     * Only applicable when the OAuth Application uses grant_type=client_credentials.
     * @param appInstallId - The app installation ID
     * @param collectionId - The stable collection id
     */
    connect(appInstallId: string, collectionId: string): Promise<McpOAuthConnectResponse> {
        return this.post(`/connect/${appInstallId}/${collectionId}`, {});
    }

    /**
     * Disconnect OAuth authentication for a specific collection
     * @param appInstallId - The app installation ID
     * @param collectionId - The stable collection id
     */
    disconnect(appInstallId: string, collectionId: string): Promise<McpOAuthDisconnectResponse> {
        return this.del(`/disconnect/${appInstallId}/${collectionId}`);
    }

    /**
     * Get or refresh OAuth token (internal use by workflows).
     * Preferred path: resolve through a specific app installation collection binding.
     * This preserves least privilege and does not rely on mutable OAuth app names.
     * @param appInstallId - The app installation ID
     * @param collectionId - The stable MCP collection id
     * @returns Access token
     */
    getCollectionToken(appInstallId: string, collectionId: string): Promise<McpOAuthTokenResponse> {
        return this.post('/token', {
            payload: { app_install_id: appInstallId, collection_id: collectionId } satisfies McpOAuthTokenRequest,
        });
    }

    /**
     * Get or refresh OAuth token (internal legacy use by workflows).
     * When oauthAppName is provided, uses the generic OAuth Application flow
     * (resolves by name in the caller's project).
     * Otherwise falls back to legacy MCP server URL-based token retrieval.
     * @param mcpServerUrl - The MCP server URL
     * @param oauthAppName - Optional OAuth Application name (from collection's oauth_app field)
     * @returns Access token
     */
    getToken(mcpServerUrl: string, oauthAppName?: string): Promise<McpOAuthTokenResponse> {
        return this.post('/token', {
            payload: oauthAppName
                ? ({ oauth_app_name: oauthAppName } satisfies McpOAuthTokenRequest)
                : ({ mcp_server_url: mcpServerUrl } satisfies McpOAuthTokenRequest)
        });
    }
}
