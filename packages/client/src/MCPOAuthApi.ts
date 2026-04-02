import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import type { OAuthAuthStatus, OAuthAuthorizeResponse, OAuthMetadataResponse } from "@vertesia/common";

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
     * @param collectionName - The collection name
     * @returns OAuth authentication status for the collection
     */
    getCollectionStatus(appInstallId: string, collectionName: string): Promise<OAuthAuthStatus> {
        return this.get(`/status/${appInstallId}/${collectionName}`);
    }

    /**
     * Get OAuth metadata for a specific collection
     * @param appInstallId - The app installation ID
     * @param collectionName - The collection name
     * @returns OAuth metadata
     */
    getMetadata(appInstallId: string, collectionName: string): Promise<OAuthMetadataResponse> {
        return this.get(`/metadata/${appInstallId}/${collectionName}`);
    }

    /**
     * Initiate OAuth authorization flow for a specific collection
     * @param appInstallId - The app installation ID
     * @param collectionName - The collection name
     * @returns Authorization URL to open for user authentication
     */
    authorize(appInstallId: string, collectionName: string): Promise<OAuthAuthorizeResponse> {
        return this.get(`/authorize/${appInstallId}/${collectionName}`);
    }

    /**
     * Connect a client_credentials OAuth Application to an MCP collection.
     * Discovers and backfills the token endpoint if not configured, then verifies credentials.
     * Only applicable when the OAuth Application uses grant_type=client_credentials.
     * @param appInstallId - The app installation ID
     * @param collectionName - The collection name
     */
    connect(appInstallId: string, collectionName: string): Promise<{ success: boolean }> {
        return this.post(`/connect/${appInstallId}/${collectionName}`, {});
    }

    /**
     * Disconnect OAuth authentication for a specific collection
     * @param appInstallId - The app installation ID
     * @param collectionName - The collection name
     */
    disconnect(appInstallId: string, collectionName: string): Promise<void> {
        return this.del(`/disconnect/${appInstallId}/${collectionName}`);
    }

    /**
     * Get or refresh OAuth token (internal use by workflows).
     * When oauthAppName is provided, uses the generic OAuth Application flow
     * (resolves by name in the caller's project).
     * Otherwise falls back to legacy MCP server URL-based token retrieval.
     * @param mcpServerUrl - The MCP server URL
     * @param oauthAppName - Optional OAuth Application name (from collection's oauth_app field)
     * @returns Access token
     */
    getToken(mcpServerUrl: string, oauthAppName?: string): Promise<{ access_token: string }> {
        return this.post('/token', {
            payload: oauthAppName
                ? { oauth_app_name: oauthAppName }
                : { mcp_server_url: mcpServerUrl }
        });
    }
}
