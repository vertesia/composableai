import { EmbeddingsResult } from "@llumiverse/common";
import { log } from "@temporalio/activity";
import { VertesiaClient } from "@vertesia/client";
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
import { DocPart, getContentParts } from "../utils/chunks.js";
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
        log.info(
            `Embeddings generation disabled for type ${type} on project: ${projectData.name} (${projectData.namespace})`,
            { config },
        );
        return {
            id: objectId,
            status: "skipped",
            message: `Embeddings generation disabled for type ${type}`,
        };
    }

    log.info(`${type} embedding generation starting for object ${objectId}`, {
        force,
        config,
    });

    if (!config.environment) {
        throw new Error(
            "No environment found in project configuration. Set environment in project configuration to generate embeddings.",
        );
    }

    const document = await client.objects.retrieve(
        objectId,
        "+text +parts +embeddings +tokens +properties",
    );

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
    { document, client, type, config, force }: ExecuteGenerateEmbeddingsParams,
    parts?: DocPart[],
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

    const { environment, model } = config;

    const partDefinitions = parts ?? [];

    // Compute text etag for comparison
    const textEtag = document.text_etag ?? (document.text ? md5(document.text) : undefined);

    // Skip if embeddings already exist with matching etag (unless force=true)
    const existingEmbedding = document.embeddings?.[type];
    if (!force && existingEmbedding?.etag && textEtag && existingEmbedding.etag === textEtag) {
        log.info(`Skipping ${type} embeddings for document ${document.id} - etag unchanged`);
        return {
            id: document.id,
            type,
            status: "skipped",
            message: "embeddings already exist with matching etag",
        };
    }

    // Count tokens if not already done or if the text has changed (etag mismatch)
    const needsTokenCount = !document.tokens?.count || (textEtag && document.tokens?.etag !== textEtag);
    if (needsTokenCount && type === SupportedEmbeddingTypes.text && document.text && textEtag) {
        log.debug("Updating token count for document: " + document.id);
        const tokensData = countTokens(document.text);
        await client.objects.update(document.id, {
            tokens: {
                ...tokensData,
                etag: textEtag,
            },
        });
        document.tokens = {
            ...tokensData,
            etag: textEtag,
        };
    }

    const maxTokens = config.max_tokens ?? 8000;

    //generate embeddings for the main doc if document isn't too large
    //if too large, we'll just generate embeddings for the parts
    //then we can generate embeddings for the main document by averaging the tensors
    log.info(`Generating ${type} embeddings for document ${document.id}`);
    if (
        type === SupportedEmbeddingTypes.text &&
        document.tokens?.count &&
        document.tokens?.count > maxTokens
    ) {
        log.info("Document too large, generating embeddings for parts");

        if (!document.text) {
            return {
                id: document.id,
                status: "failed",
                message: "no text found",
            };
        }

        if (!partDefinitions || partDefinitions.length === 0) {
            log.info(
                "No parts found for document, skipping embeddings generation",
            );
            return {
                id: document.id,
                status: "failed",
                message: "no parts found",
            };
        }

        log.info("Generating embeddings for parts", {
            parts: partDefinitions,
            max_tokens: maxTokens,
        });
        const docParts = getContentParts(document.text, partDefinitions);

        log.info(`Retrieved ${docParts.length} parts`);
        const start = new Date().getTime();
        const generatePartEmbeddings = async (
            partContent: string,
            i: number,
        ) => {
            const localStart = new Date().getTime();
            try {
                log.info(`Generating embeddings for part ${i}`, {
                    text_len: partContent.length,
                });
                if (!partContent) {
                    return {
                        id: i,
                        number: i,
                        result: null,
                        status: "skipped",
                        message: "no text found",
                    };
                }

                const e = await generateEmbeddingsFromStudio(
                    partContent,
                    environment,
                    client,
                    model,
                ).catch((e) => {
                    log.error("Error generating embeddings for part " + i, {
                        text_length: partContent.length,
                        error: e,
                    });
                    return null;
                });

                if (!e || !e.values) {
                    return {
                        id: i,
                        number: i,
                        result: null,
                        message: "no embeddings generated",
                    };
                }

                if (e.values.length === 0) {
                    return {
                        id: i,
                        number: i,
                        result: null,
                        message: "no embeddings generated",
                    };
                }
                log.info(`Generated embeddings for part ${i}`, {
                    len: e.values.length,
                    duration: new Date().getTime() - localStart,
                });

                return { number: i, result: e };
            } catch (err: any) {
                log.info(
                    `Error generating ${type} embeddings for part ${i} of ${document.id}`,
                    { error: err },
                );
                return {
                    number: i,
                    result: null,
                    message: "error generating embeddings",
                    error: err.message,
                };
            }
        };

        const partEmbeddings = await Promise.all(
            docParts.map((part, i) => generatePartEmbeddings(part, i)),
        );
        const validPartEmbeddings = partEmbeddings
            .filter((e) => e.result !== null)
            .map((e) => e.result);
        const averagedEmbedding = computeAttentionEmbedding(
            validPartEmbeddings.map((e) => e.values),
        );
        log.info(
            `Averaged embeddings for document ${document.id} in ${(new Date().getTime() - start) / 1000} seconds`,
            {
                len: averagedEmbedding.length,
                count: validPartEmbeddings.length,
                max_tokens: maxTokens,
            },
        );
        await client.objects.setEmbedding(document.id, type, {
            values: averagedEmbedding,
            model: validPartEmbeddings[0].model,
            etag: textEtag,
        });
        log.info(`Object ${document.id} embedding set`, {
            type,
            len: averagedEmbedding.length,
        });
    } else {
        log.info(`Generating ${type} embeddings for document`);

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

        log.info(`${type} embeddings generated for document ${document.id}`, {
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
    log.info("Generating image embeddings for document " + document.id, {
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
        log.info(`Skipping ${type} embeddings for document ${document.id} - content etag unchanged`);
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
    log.info(
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

//Simplified attention mechanism
// This is a naive implementation and should be replaced with a more sophisticated
// using tensorflow in a specific package
function computeAttentionEmbedding(chunkEmbeddings: number[][]): number[] {
    if (chunkEmbeddings.length === 0) return [];

    const start = new Date().getTime();

    // Generate random attention weights
    const attentionWeights = chunkEmbeddings.map(() => Math.random());

    // Apply softmax to get attention scores
    const expWeights = attentionWeights.map((w) => Math.exp(w));
    const sumExpWeights = expWeights.reduce((sum, val) => sum + val, 0);
    const attentionScores = expWeights.map((w) => w / sumExpWeights);

    // Get embedding dimension
    const embeddingDim = chunkEmbeddings[0].length;

    // Initialize document embedding
    const documentEmbedding = new Array(embeddingDim).fill(0);

    // Weighted sum of embeddings
    for (let i = 0; i < chunkEmbeddings.length; i++) {
        for (let j = 0; j < embeddingDim; j++) {
            documentEmbedding[j] += chunkEmbeddings[i][j] * attentionScores[i];
        }
    }

    const duration = new Date().getTime() - start;
    console.log(
        `Computed document embedding in ${duration}ms for ${chunkEmbeddings.length} chunks`,
    );

    return documentEmbedding;
}
