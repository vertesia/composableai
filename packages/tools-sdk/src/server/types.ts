import type { Context } from 'hono';
import type { ActivityCollection } from '../ActivityCollection.js';
import type { InteractionCollection } from '../InteractionCollection.js';
import type { SkillCollection } from '../SkillCollection.js';
import type { RenderingTemplateCollection } from '../RenderingTemplateCollection.js';
import type { ToolCollection } from '../ToolCollection.js';
import type { ToolExecutionPayload } from '../types.js';
import type { JSONSchema } from '@llumiverse/common';
import type { AppUIConfig, InCodeProcessDefinition, ProjectConfiguration } from '@vertesia/common';
import type { AuthSession } from '../auth.js';
import type { ContentTypesCollection } from '../ContentTypesCollection.js';
import type { MCPConnectionDetails } from '../types.js';

/**
 * Extended context with parsed payload for tool/skill execution
 */
export interface ToolContext extends Context {
    /** The parsed request payload */
    payload?: ToolExecutionPayload;
    /** The tool_use.id from the payload */
    toolUseId?: string;
    /** The tool_use.tool_name from the payload */
    toolName?: string;
}

/**
 * MCP Provider interface for server configuration
 */
export interface MCPProviderConfig {
    name: string;
    description?: string;
    createMCPConnection: (session: AuthSession, config: Record<string, unknown>) => Promise<MCPConnectionDetails>;
}

/**
 * Server configuration options
 */
export interface ToolServerConfig {
    /**
     * Server title for HTML pages (default: 'Tools Server')
     */
    title?: string;
    /**
     * API prefix (default: '/api')
     */
    prefix?: string;
    /**
     * Tool collections to expose
     */
    tools?: ToolCollection[];
    /**
     * Activity collections to expose for DSL workflows
     */
    activities?: ActivityCollection[];
    /**
     * Interaction collections to expose
     */
    interactions?: InteractionCollection[];
    /**
     * Content type collections to expose
     */
    types?: ContentTypesCollection[];
    /**
     * Process definitions to expose as app-contributed processes.
     */
    processes?: InCodeProcessDefinition[];
    /**
     * Skill collections to expose
     */
    skills?: SkillCollection[];
    /**
     * Template collections to expose
     */
    templates?: RenderingTemplateCollection[];
    /**
     * MCP providers to expose
     */
    mcpProviders?: MCPProviderConfig[];

    /**
     * A JSON schema defining settings for the application using this server
     */
    settings?: JSONSchema;

    /**
     * The UI configuration for the application using this server
     */
    uiConfig?: AppUIConfig;

    /**
     * Disable HTML pages (default: false)
     */
    disableHtml?: boolean;
    /**
     * Hide UI app links on the index page (default: false)
     */
    hideUILinks?: boolean;

    /**
     * If a filter is provided, it will be called with the project configuration when requesting tool definitions, and can be used to filter which tools are returned based on the project configuration.
     * This allows for dynamic enabling/disabling of tools based on project settings.
     * @param projectConfig
     * @returns
     */
    toolFilter?: (projectConfig: ProjectConfiguration) => boolean;
}
