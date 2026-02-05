import { MCPConnectionDetails } from "@vertesia/tools-sdk";
import { AuthSession } from "@vertesia/tools-sdk";
export declare abstract class MCPProvider {
    name: string;
    description?: string;
    constructor(name: string, description?: string);
    abstract createMCPConnection(session: AuthSession, config: Record<string, any>): Promise<MCPConnectionDetails>;
}
//# sourceMappingURL=MCPProvider.d.ts.map