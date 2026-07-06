/**
 * Types for ask_user tool UX configuration.
 * These types enable the model to transmit structured UX parameters
 * that render as interactive widgets instead of plain text.
 */

/** Option for user selection in ask_user widget */
export interface AskUserOption {
    /** Unique identifier returned when this option is selected */
    id: string;
    /** Display text for the option */
    label: string;
    /** Optional tooltip/description shown on hover */
    description?: string;
}

/** Identifies an MCP server the user is asked to connect to (request_mcp_connection). */
export interface McpConnectUxConfig {
    /** The app installation id owning the collection (used for the OAuth flow). */
    app_install_id: string;
    /** The MCP tool-collection id. */
    collection_id: string;
    /** Human-readable server name shown in the prompt. */
    name: string;
}

/** Optional free-form response rendered alongside predefined options. */
export interface AskUserFreeResponseConfig {
    /** Placeholder text for the input. */
    placeholder?: string;
    /** Label for the submit button. */
    submit_label?: string;
    /** Extra metadata sent with the user input signal when submitted. */
    metadata?: Record<string, unknown>;
}

/** UX configuration for ask_user / request_mcp_connection messages */
export interface AskUserUxConfig {
    /** Predefined options for the user to select from */
    options?: AskUserOption[];
    /** Visual style variant */
    variant?: 'default' | 'warning' | 'info' | 'success';
    /** Allow selecting multiple options (renders checkboxes instead of buttons) */
    multiSelect?: boolean;
    /**
     * Render a free-form response input. When options are also present, this is
     * treated as an alternate response path.
     */
    free_response?: AskUserFreeResponseConfig;
    /**
     * Renders an MCP "Connect" button instead of plain options. Set by the
     * request_mcp_connection tool when the agent needs the user to connect a server.
     */
    mcp_connect?: McpConnectUxConfig;
}

/** Message details structure for REQUEST_INPUT messages with UX config */
export interface AskUserMessageDetails {
    /** UX configuration for rendering the ask_user widget */
    ux?: AskUserUxConfig;
}
