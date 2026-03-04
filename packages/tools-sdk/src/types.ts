import type { ToolDefinition, ToolUse } from "@llumiverse/common";
import { VertesiaClient } from "@vertesia/client";
import { AgentToolDefinition, AuthTokenPayload, ProjectConfiguration, ToolExecutionMetadata, ToolResult, ToolResultContent } from "@vertesia/common";

export type { ToolExecutionMetadata };

export type ICollection<T = any> = CollectionProperties & Iterable<T>

export interface CollectionProperties {
    /**
     * A kebab case collection name. Must only contains alphanumeric and dash characters,
     * The name can be used to generate the path where the collection is exposed.
     * Example: my-collection
     */
    name: string;
    /**
     * Optional title for UI display. 
     * If not provided the pascal case version of the name will be used
     */
    title?: string;
    /**
     * Optional icon for UI display
     */
    icon?: string;
    /**
     * A short description 
     */
    description?: string;
}

export interface ToolExecutionContext {
    /**
     * The raw JWT token to the tool execution request
     */
    token: string;
    /**
     * The decoded JWT token
     */
    payload: AuthTokenPayload;
    /**
     * Vertesia client factory using the current auth token.
     * @returns a vertesia client instance
     */
    getClient: () => Promise<VertesiaClient>;
}

export interface ToolExecutionResult extends ToolResultContent {
    /**
     * Medata can be used to return more info on the tool execution like stats or user messages.
     */
    meta?: Record<string, any>;
}

export interface ToolExecutionResponse extends ToolExecutionResult, ToolResult {
    /**
     * The tool use id of the tool use request. For traceability.
     */
    tool_use_id: string;
}

export interface ToolExecutionResponseError {
    /**
     * The tool use id of the tool use request. For traceability.
     */
    tool_use_id: string;
    /**
     * The http status code
     */
    status: number;
    /**
     * the error message
     */
    error: string;
    /**
     * Additional context information
     */
    data?: Record<string, any>;
}

export interface ToolExecutionPayload<ParamsT extends Record<string, any>> {
    tool_use: ToolUse<ParamsT>,
    /**
     * Optional metadata related to the current execution request
     */
    metadata?: ToolExecutionMetadata,
}

export type ToolFn<ParamsT extends Record<string, any>> = (payload: ToolExecutionPayload<ParamsT>, context: ToolExecutionContext) => Promise<ToolExecutionResult>;

export interface ToolUseContext {
    project_id?: string,
    account_id?: string,
    project_name?: string,
    project_ns?: string,
    configuration?: ProjectConfiguration;
    vars?: Record<string, any>;
}

export interface Tool<ParamsT extends Record<string, any>> extends ToolDefinition {
    run: ToolFn<ParamsT>;
    /**
     * Whether this tool is available by default.
     * - true/undefined: Tool is always available to agents
     * - false: Tool is only available when activated by a skill's related_tools
     */
    default?: boolean;

    /**
     * Optional filter to check if the tool is enabled for the given project configuration.
     * This can be used to dynamically enable/disable tools based on project settings, environment variables, or any other logic.
     * If no filter is provided, the tool will be enabled by default.
     * @param payload 
     * @returns 
     */
    isEnabled?: (payload: ToolUseContext) => boolean;
}


/**
 * The interface that should be returned when requesting a collection endpoint using a GET
 */
export interface ToolCollectionDefinition {
    title: string;
    description: string;
    src: string;
    tools: AgentToolDefinition[];
}

export type { ToolDefinition };

/**
 * The details of a connection to a MCP server - including the server URL and an authentication token
 */
export interface MCPConnectionDetails {
    /**
     * The mcp server name. It will be used to prefix tool names.
     */
    name: string;
    /**
     * The target mcp server URL
     */
    url: string;
    /**
     * The bearer authentication token to use when connecting to the mcp server.
     * If an empty string no authentication will be done
     */
    token: string;
    /**
     * Optional additional HTTP headers to include with requests to the MCP server.
     * Merged with the Authorization header derived from the token.
     */
    headers?: Record<string, string>;
}

// ================== Skill Types ==================

/**
 * Content type for skill instructions
 */
export type SkillContentType = 'md' | 'jst';

/**
 * Context triggers for auto-injection of skills
 */
export interface SkillContextTriggers {
    /**
     * Keywords in user input that should trigger this skill
     */
    keywords?: string[];
    /**
     * If these tools are being used, suggest this skill
     */
    tool_names?: string[];
    /**
     * Regex patterns to match against input data
     */
    data_patterns?: string[];
}

/**
 * Execution configuration for skills that need code execution
 */
export interface SkillExecution {
    /**
     * The programming language for execution
     */
    language: string;
    /**
     * Required packages to install
     */
    packages?: string[];
    /**
     * System-level packages to install (e.g., apt-get packages)
     */
    system_packages?: string[];
    /**
     * Code template to execute
     */
    template?: string;
}


/**
 * Skill definition - parsed from SKILL.md or SKILL.jst
 */
export interface SkillDefinition {
    /**
     * Unique skill name (kebab-case)
     */
    name: string;
    /**
     * Display title
     */
    title?: string;
    /**
     * Short description for discovery
     */
    description: string;
    /**
     * The skill instructions (markdown or JST template)
     */
    instructions: string;
    /**
     * Content type: 'md' for static markdown, 'jst' for dynamic templates
     */
    content_type: SkillContentType;
    /**
     * JSON Schema for skill input parameters.
     * Used when skill is exposed as a tool.
     */
    input_schema?: {
        type: 'object';
        properties?: Record<string, any>;
        required?: string[];
    };
    /**
     * Context triggers for auto-injection
     */
    context_triggers?: SkillContextTriggers;
    /**
     * Execution configuration for code-based skills
     */
    execution?: SkillExecution;
    /**
     * Related tools that work well with this skill
     */
    related_tools?: string[];
    /**
     * Scripts bundled with this skill (synced to sandbox when skill is used)
     */
    scripts?: string[];
    /**
     * The name of the widgets provided by this skill (if any)
     * The name will be used to load the widget dynamically from the agent chat
     * and must match the code block language returned by the LLM (e.g., ```my-widget)
     * which will be rendered using the widget.
     * The widget file must be located in the skill directory under the name {{widget-name}}.tsx.
     */
    widgets?: string[];

    /**
     * Optional filter to check if the tool is enabled for the given project configuration.
     * This can be used to dynamically enable/disable tools based on project settings, environment variables, or any other logic.
     * If no filter is provided, the tool will be enabled by default.
     * @param payload 
     * @returns 
     */
    isEnabled?: (payload: ToolUseContext) => boolean;

}

/**
 * Skill execution payload
 */
export interface SkillExecutionPayload {
    /**
     * The skill name to execute
     */
    skill_name: string;
    /**
     * Data context for JST template rendering
     */
    data?: Record<string, any>;
    /**
     * Whether to execute the code template (if present)
     */
    execute?: boolean;
}

/**
 * Skill execution result
 */
export interface SkillExecutionResult {
    /**
     * The skill name
     */
    name: string;
    /**
     * Rendered instructions
     */
    instructions: string;
    /**
     * Execution output (if execute=true and skill has code template)
     */
    execution_result?: {
        output: string;
        files?: string[];
        is_error: boolean;
    };
}

/**
 * Skill collection definition - returned by GET endpoint
 */
export interface SkillCollectionDefinition {
    name: string;
    title: string;
    description: string;
    skills: SkillDefinition[];
}
