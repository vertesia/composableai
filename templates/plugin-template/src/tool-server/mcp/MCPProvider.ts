import { MCPConnectionDetails } from "@vertesia/tools-sdk";
import { AuthSession } from "@vertesia/tools-sdk";


export abstract class MCPProvider {
    name: string;
    description?: string;
    constructor(name: string, description?: string) {
        this.name = name;
        this.description = description;
    }

    /**
     * Generate an authorization token to access the returned mcp server URL. the mcp server URL is returned in the generation payload since
     * it may change depending on the session and config vars.
     * @param session 
     * @param config 
     */
    abstract createMCPConnection(session: AuthSession, config: Record<string, unknown>): Promise<MCPConnectionDetails>;

}


