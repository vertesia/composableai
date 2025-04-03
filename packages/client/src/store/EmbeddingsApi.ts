import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import {
    EmbeddingsStatusResponse,
    GenericCommandResponse,
    ProjectConfigurationEmbeddings,
    SupportedEmbeddingTypes,
} from "@vertesia/common";

/**
 * @since 0.52.0
 */
export class EmbeddingsApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/embeddings");
    }

    async status(type: SupportedEmbeddingTypes): Promise<EmbeddingsStatusResponse> {
        return this.get(type + "/status");
    }

    async activate(type: SupportedEmbeddingTypes, config: Partial<ProjectConfigurationEmbeddings>): Promise<GenericCommandResponse> {

        if (!config.environment) {
            throw new Error("Invalid configuration: select environment");
        }

        return this.post(type + "/enable", { payload: config });
    }

    async disable(type: SupportedEmbeddingTypes): Promise<GenericCommandResponse> {
        return this.post(type + "/disable");
    }

    async recalculate(type: SupportedEmbeddingTypes): Promise<GenericCommandResponse> {
        return this.post(type + "/recalculate");
    }

}