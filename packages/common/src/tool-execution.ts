/**
 * Types for tool execution payloads shared between workflows and tool servers
 */

/**
 * Endpoint configuration that can override JWT-embedded endpoints
 */
export interface ToolEndpointOverrides {
    /**
     * Studio server URL
     */
    studio?: string;
    /**
     * Store/Zeno server URL
     */
    store?: string;
    /**
     * Token server URL
     */
    token?: string;
}

/**
 * Metadata passed with tool execution requests from workflows to tool servers
 */
export interface ToolExecutionMetadata {
    /**
     * Workflow run ID
     */
    run_id?: string;
    /**
     * App installation ID
     */
    app_install_id?: string;
    /**
     * App-specific settings
     */
    app_settings?: Record<string, any>;
    /**
     * Endpoint overrides from workflow config (takes precedence over JWT endpoints)
     */
    endpoints?: ToolEndpointOverrides;
    /**
     * Additional metadata fields
     */
    [key: string]: any;
}
