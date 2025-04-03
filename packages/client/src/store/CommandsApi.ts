import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import { EmbeddingsApi } from "./EmbeddingsApi.js";

/**
 * @deprecated use EmbeddingsApi instead
 * @see EmbeddingsApi
 */
export class CommandsApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/api/v1/commands");
    }

    embeddings = new EmbeddingsApi(this);
}
