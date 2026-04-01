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
     * Workflow run ID (Temporal execution ID)
     */
    run_id?: string;
    /**
     * Artifact storage path prefix for uploadArtifact/downloadArtifact calls.
     * Resolves to agent_run_id (+ workstream launch_id) when available,
     * falls back to run_id for legacy workflows.
     */
    artifact_storage_id?: string;
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
