import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import type { BuiltinToolsCatalogResponse } from "@vertesia/common";

/**
 * API for accessing the builtin tools catalog
 */
export class ToolsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/tools");
    }

    /**
     * Get the builtin tools catalog
     * @returns List of all available builtin tools with their descriptions and parameter schemas
     */
    getBuiltinCatalog(): Promise<BuiltinToolsCatalogResponse> {
        return this.get('/');
    }
}
