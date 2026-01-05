import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";

export interface OAuthAuthStatus {
    authenticated: boolean;
    mcp_server_url: string;
    expires_at?: string;
    scope?: string;
}

export interface OAuthAuthorizeResponse {
    authorization_url: string;
    state: string;
}

export default class MCPOAuthApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/api/v1/mcp/oauth")
    }

    /**
     * Get OAuth authentication status for an app installation
     * @param appInstallId - The app installation ID
     * @returns OAuth authentication status
     */
    getStatus(appInstallId: string): Promise<OAuthAuthStatus> {
        return this.get(`/status/${appInstallId}`);
    }

    /**
     * Initiate OAuth authorization flow
     * @param appInstallId - The app installation ID
     * @returns Authorization URL to open for user authentication
     */
    authorize(appInstallId: string): Promise<OAuthAuthorizeResponse> {
        return this.get(`/authorize/${appInstallId}`);
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
