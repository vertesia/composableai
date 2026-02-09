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
     * Disconnect OAuth authentication for an MCP server
     * @param mcpServerUrl - The MCP server URL
     */
    disconnect(mcpServerUrl: string): Promise<void> {
        return this.del(`/disconnect/${encodeURIComponent(mcpServerUrl)}`);
    }

    /**
     * Get or refresh OAuth token for an MCP server (internal use by workflows)
     * @param mcpServerUrl - The MCP server URL
     * @returns Access token
     */
    getToken(mcpServerUrl: string): Promise<{ access_token: string }> {
        return this.post('/token', {
            payload: { mcp_server_url: mcpServerUrl }
        });
    }
}
