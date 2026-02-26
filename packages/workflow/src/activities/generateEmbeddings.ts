import { EmbeddingsResult } from "@llumiverse/common";
import { log } from "@temporalio/activity";
import { VertesiaClient, ZenoClientNotFoundError } from "@vertesia/client";
import {
    ContentObject,
    DSLActivityExecutionPayload,
    DSLActivitySpec,
    ImageRenditionFormat,
    ProjectConfigurationEmbeddings,
    SupportedEmbeddingTypes,
} from "@vertesia/common";
import { setupActivity } from "../dsl/setup/ActivityContext.js";
import { DocumentNotFoundError } from "../errors.js";
import { fetchBlobAsBase64, md5 } from "../utils/blobs.js";
import { DocPart } from "../utils/chunks.js";
import { countTokens } from "../utils/tokens.js";

export interface GenerateEmbeddingsParams {
    /**
     * The model to use for embedding generation
     * If not set, the default model for the project will be used
     */
    model?: string;

    /**
     * The environment to use for embedding generation
     * If not set, the default environment for the project will be used
     */
    environment?: string;

    /**
     * If true, force embedding generation even if the document already has embeddings
     */
    force?: boolean;

    /**
     * The embedding type to generate
     */
    type: SupportedEmbeddingTypes;

    /**
     * The DocParts to use for long documents
     */
    parts?: DocPart[];
}

export interface GenerateEmbeddings
    extends DSLActivitySpec<GenerateEmbeddingsParams> {
    name: "generateEmbeddings";
}

export async function generateEmbeddings(
    payload: DSLActivityExecutionPayload<GenerateEmbeddingsParams>,
) {
    const { params, client, objectId, fetchProject } =
        await setupActivity<GenerateEmbeddingsParams>(payload);
    const { force, type } = params;

    const projectData = await fetchProject();
    const config = projectData?.configuration.embeddings[type];
    if (!projectData) {
        throw new DocumentNotFoundError("Project not found", [payload.project_id]);
    }
    if (!config) {
        throw new DocumentNotFoundError("Embeddings configuration not found", [
            objectId,
        ]);
    }

    if (!projectData) {
        throw new DocumentNotFoundError("Project not found", [payload.project_id]);
    }

    if (!projectData?.configuration.embeddings[type]?.enabled) {
        log.debug(
            `Embeddings generation disabled for type ${type} on project: ${projectData.name} (${projectData.namespace})`,
            { config },
        );
        return {
            id: objectId,
            status: "skipped",
            message: `Embeddings generation disabled for type ${type}`,
        };
    }

    log.debug(`${type} embedding generation starting for object ${objectId}`, {
        force,
        config,
    });

    if (!config.environment) {
        throw new Error(
            "No environment found in project configuration. Set environment in project configuration to generate embeddings.",
        );
    }

    let document;
    try {
        document = await client.objects.retrieve(
            objectId,
            "+text +parts +embeddings +tokens +properties",
        );
    } catch (error) {
        if (error instanceof ZenoClientNotFoundError) {
            throw new DocumentNotFoundError(`Document not found: ${objectId}`, [objectId]);
        }
        throw error;
    }

    if (!document) {
        throw new DocumentNotFoundError("Document not found", [objectId]);
    }

    if (!document.content) {
        throw new DocumentNotFoundError("Document content not found", [objectId]);
    }

    let res;

    switch (type) {
        case SupportedEmbeddingTypes.text:
            res = await generateTextEmbeddings({
                client,
                config,
                document,
                type,
                force,
            });
            break;
        case SupportedEmbeddingTypes.properties:
            res = await generateTextEmbeddings({
                client,
                config,
                document,
                type,
                force,
            });
            break;
        case SupportedEmbeddingTypes.image:
            res = await generateImageEmbeddings({
                client,
                config,
                document,
                type,
                force,
            });
            break;
        default:
            res = {
                id: objectId,
                status: "failed",
                message: `unsupported embedding type: ${type}`,
            };
    }

    return res;
}

interface ExecuteGenerateEmbeddingsParams {
    document: ContentObject;
    client: VertesiaClient;
    type: SupportedEmbeddingTypes;
    config: ProjectConfigurationEmbeddings;
    property?: string;
    force?: boolean;
}

async function generateTextEmbeddings(
    { document, client, type, config, force }: ExecuteGenerateEmbeddingsParams
) {

    if (!document) {
        return { status: "error", message: "document is null or undefined" };
    }

    if (
        type !== SupportedEmbeddingTypes.text &&
        type !== SupportedEmbeddingTypes.properties
    ) {
        return {
            id: document.id,
            status: "failed",
            message: `unsupported embedding type: ${type}`,
        };
    }

    if (type === SupportedEmbeddingTypes.text && !document.text) {
        return { id: document.id, status: "failed", message: "no text found" };
    }
    if (type === SupportedEmbeddingTypes.properties && !document?.properties) {
        return {
            id: document.id,
            status: "failed",
            message: "no properties found",
        };
    }

    const { environment } = config;

    // Compute text etag for comparison
    const textEtag = document.text_etag ?? (document.text ? md5(document.text) : undefined);

    // Skip if embeddings already exist with matching etag (unless force=true)
    const existingEmbedding = document.embeddings?.[type];
    if (!force && existingEmbedding?.etag && textEtag && existingEmbedding.etag === textEtag) {
        log.debug(`Skipping ${type} embeddings for document ${document.id} - etag unchanged`);
        return {
            id: document.id,
            type,
            status: "skipped",
            message: "embeddings already exist with matching etag",
        };
    }

    // Count tokens if needed, do not rely on existing token count
    let tokenCount : number | undefined = undefined;
    if (type === SupportedEmbeddingTypes.text && document.text) {
        tokenCount = countTokens(document.text).count;
    }

    const maxTokens = config.max_tokens ?? 8000;

    //generate embeddings for the main doc if document isn't too large
    log.debug(`Generating ${type} embeddings for document ${document.id}`);
    if (
        type === SupportedEmbeddingTypes.text &&
        tokenCount !== undefined &&
        tokenCount > maxTokens
    ) {
        //TODO: Review strategy for large documents
        log.warn(
            `Document too large for ${type} embeddings generation, skipping (${tokenCount} tokens)`,
        );
        return {
            id: document.id,
            status: "skipped",
            message: `${type} embeddings generation, skipped for large document (${tokenCount} tokens)`,
        }
    } else {
        log.debug(`Generating ${type} embeddings for document`);

        const res = await generateEmbeddingsFromStudio(
            JSON.stringify(document[type]),
            environment,
            client,
        );
        if (!res || !res.values) {
            return {
                id: document.id,
                status: "failed",
                message: "no embeddings generated",
            };
        }

        log.debug(`${type} embeddings generated for document ${document.id}`, {
            len: res.values.length,
        });
        await client.objects.setEmbedding(document.id, type, {
            values: res.values,
            model: res.model,
            etag: textEtag,
        });

        return {
            id: document.id,
            type,
            status: "completed",
            len: res.values.length,
        };
    }
}

async function generateImageEmbeddings({
    document,
    client,
    type,
    config,
    force,
}: ExecuteGenerateEmbeddingsParams) {
    log.debug("Generating image embeddings for document " + document.id, {
        content: document.content,
    });
    if (
        !document.content?.type?.startsWith("image/") &&
        !document.content?.type?.includes("pdf")
    ) {
        return {
            id: document.id,
            type,
            status: "failed",
            message: "content is not an image",
        };
    }

    // Use content etag for image change detection
    const contentEtag = document.content?.etag;

    // Skip if embeddings already exist with matching etag (unless force=true)
    const existingEmbedding = document.embeddings?.[type];
    if (!force && existingEmbedding?.etag && contentEtag && existingEmbedding.etag === contentEtag) {
        log.debug(`Skipping ${type} embeddings for document ${document.id} - content etag unchanged`);
        return {
            id: document.id,
            type,
            status: "skipped",
            message: "embeddings already exist with matching etag",
        };
    }

    const { environment, model } = config;

    const resRnd = await client.store.objects.getRendition(document.id, {
        format: ImageRenditionFormat.jpeg,
        generate_if_missing: true,
        sign_url: true,
    });

    if (resRnd.status === "generating") {
        throw new Error("Rendition is generating, will retry later");
    } else if (
        resRnd.status === "failed" ||
        !resRnd.renditions ||
        !resRnd.renditions.length
    ) {
        throw new DocumentNotFoundError("Rendition retrieval failed", [document.id]);
    }

    const renditions = resRnd.renditions;
    if (!renditions?.length) {
        throw new DocumentNotFoundError("No source found in rendition", [
            document.id,
        ]);
    }

    const rendition = renditions[0];
    const image = await fetchBlobAsBase64(client, rendition);

    const res = await client.environments
        .embeddings(environment, {
            image,
            model,
        })
        .then((res) => res)
        .catch((e) => {
            log.error("Error generating embeddings for image", { error: e });
            throw e;
        });

    if (!res || !res.values) {
        return {
            id: document.id,
            status: "failed",
            message: "no embeddings generated",
        };
    }

    await client.objects.setEmbedding(
        document.id,
        SupportedEmbeddingTypes.image,
        {
            values: res.values,
            model: res.model,
            etag: contentEtag,
        },
    );

    return {
        id: document.id,
        type,
        status: "completed",
        len: res.values.length,
    };
}

async function generateEmbeddingsFromStudio(
    text: string,
    env: string,
    client: VertesiaClient,
    model?: string,
): Promise<EmbeddingsResult> {
    log.debug(
        `Generating embeddings for text of ${text.length} chars with environment ${env}`,
    );

    return client.environments
        .embeddings(env, {
            text,
            model,
        })
        .then((res) => res)
        .catch((e) => {
            log.error("Error generating embeddings for text", { error: e });
            throw e;
        });
}
