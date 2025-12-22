import { InteractionCollection } from "../InteractionCollection.js";
import { SkillCollection } from "../SkillCollection.js";
import { ToolCollection } from "../ToolCollection.js";

/**
 * MCP Provider interface for server configuration
 */
export interface MCPProviderConfig {
    name: string;
    description?: string;
    createMCPConnection: (session: any, config: Record<string, any>) => Promise<{
        name: string;
        url: string;
        token: string;
    }>;
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
     * Interaction collections to expose
     */
    interactions?: InteractionCollection[];
    /**
     * Skill collections to expose
     */
    skills?: SkillCollection[];
    /**
     * MCP providers to expose
     */
    mcpProviders?: MCPProviderConfig[];
    /**
     * Disable HTML pages (default: false)
     */
    disableHtml?: boolean;
}
