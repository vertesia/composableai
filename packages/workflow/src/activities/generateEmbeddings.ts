import { EmbeddingsResult } from "@llumiverse/core";
import { log } from "@temporalio/activity";
import { VertesiaClient } from "@vertesia/client";
import { ContentObject, DSLActivityExecutionPayload, DSLActivitySpec, ProjectConfigurationEmbeddings, SupportedEmbeddingTypes } from "@vertesia/common";
import { setupActivity } from "../dsl/setup/ActivityContext.js";
import { NoDocumentFound } from '../errors.js';
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

export interface GenerateEmbeddings extends DSLActivitySpec<GenerateEmbeddingsParams> {
    name: 'generateEmbeddings';
}

export async function generateEmbeddings(payload: DSLActivityExecutionPayload<GenerateEmbeddingsParams>) {
    const { params, client, objectId, fetchProject } = await setupActivity<GenerateEmbeddingsParams>(payload);
    const { force, type } = params;

    const projectData = await fetchProject();
    const config = projectData?.configuration.embeddings[type];
    if (!projectData) {
        throw new NoDocumentFound('Project not found', [payload.project_id]);
    }
    if (!config) {
        throw new NoDocumentFound('Embeddings configuration not found', [objectId])
    }

    if (!projectData) {
        throw new NoDocumentFound('Project not found', [payload.project_id]);
    }

    if (!projectData?.configuration.embeddings[type]?.enabled) {
        log.info(`Embeddings generation disabled for type ${type} on project: ${projectData.name} (${projectData.namespace})`, { config });
        return { id: objectId, status: "skipped", message: `Embeddings generation disabled for type ${type}` }
    }

    log.info(`${type} embedding generation starting for object ${objectId}`, { force, config });

    if (!config.environment) {
        throw new Error('No environment found in project configuration. Set environment in project configuration to generate embeddings.');
    }

    const document = await client.objects.retrieve(objectId, "+text +parts +embeddings +tokens +properties");

    if (!document) {
        throw new NoDocumentFound('Document not found', [objectId]);
    }

    if (!document.content) {
        throw new NoDocumentFound('Document content not found', [objectId]);
    }

    let res;

    switch (type) {
        case SupportedEmbeddingTypes.text:
            res = await generateTextEmbeddings({
                client,
                config,
                document,
                type
            })
            break;
        case SupportedEmbeddingTypes.properties:
            res = await generateTextEmbeddings({
                client,
                config,
                document,
                type,
            });
            break;
        case SupportedEmbeddingTypes.image:
            res = await generateImageEmbeddings({
                client,
                config,
                document,
                type
            });
            break;
        default:
            res = { id: objectId, status: "failed", message: `unsupported embedding type: ${type}` }
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

async function generateTextEmbeddings({ document, client, type, config }: ExecuteGenerateEmbeddingsParams, parts?: DocPart[],) {
    // if (!force && document.embeddings[type]?.etag === (document.text_etag ?? md5(document.text))) {
    //     return { id: objectId, status: "skipped", message: "embeddings already generated" }
    // }

    if (!document) {
        return { status: "error", message: "document is null or undefined" }
    }

    if (type !== SupportedEmbeddingTypes.text && type !== SupportedEmbeddingTypes.properties) {
        return { id: document.id, status: "failed", message: `unsupported embedding type: ${type}` }
    }

    if (type === SupportedEmbeddingTypes.text && !document.text) {
        return { id: document.id, status: "failed", message: "no text found" }
    }
    if (type === SupportedEmbeddingTypes.properties && !document?.properties) {
        return { id: document.id, status: "failed", message: "no properties found" }
    }

    const { environment, model } = config;

    const partDefinitions = parts ?? [];

    // Count tokens if not already done
    if (!document.tokens?.count && type === SupportedEmbeddingTypes.text) {
        log.debug('Updating token count for document: ' + document.id);
        const tokensData = countTokens(document.text!);
        await client.objects.update(document.id, {
            tokens: {
                ...tokensData,
                etag: document.text_etag ?? md5(document.text!)
            }
        });
        document.tokens = {
            ...tokensData,
            etag: document.text_etag ?? md5(document.text!)
        };
    }

    const maxTokens = config.max_tokens ?? 8000;

    //generate embeddings for the main doc if document isn't too large
    //if too large, we'll just generate embeddings for the parts
    //then we can generate embeddings for the main document by averaging the tensors
    log.info(`Generating ${type} embeddings for document ${document.id}`);
    if (type === SupportedEmbeddingTypes.text && document.tokens?.count && document.tokens?.count > maxTokens) {
        log.info('Document too large, generating embeddings for parts');


        if (!document.text) {
            return { id: document.id, status: "failed", message: "no text found" }
        }

        if (!partDefinitions || partDefinitions.length === 0) {
            log.info('No parts found for document, skipping embeddings generation');
            return { id: document.id, status: "failed", message: "no parts found" }
        }


        log.info('Generating embeddings for parts', { parts: partDefinitions, max_tokens: maxTokens });
        const docParts = getContentParts(document.text, partDefinitions);


        log.info(`Retrieved ${docParts.length} parts`)
        const start = new Date().getTime();
        const generatePartEmbeddings = async (partContent: string, i: number) => {
            const localStart = new Date().getTime();
            try {
                log.info(`Generating embeddings for part ${i}`, { text_len: partContent.length })
                if (!partContent) {
                    return { id: i, number: i, result: null, status: "skipped", message: "no text found" }
                }

                const e = await generateEmbeddingsFromStudio(partContent, environment, client, model).catch(e => {
                    log.error('Error generating embeddings for part ' + i, { text_length: partContent.length, error: e });
                    return null;
                });

                if (!e || !e.values) {
                    return { id: i, number: i, result: null, message: "no embeddings generated" }
                }

                if (e.values.length === 0) {
                    return { id: i, number: i, result: null, message: "no embeddings generated" }
                }
                log.info(`Generated embeddings for part ${i}`, { len: e.values.length, duration: new Date().getTime() - localStart });

                return { inumber: i, result: e }
            } catch (err: any) {
                log.info(`Error generating ${type} embeddings for part ${i} of ${document.id}`, { error: err });
                return { number: i, result: null, message: "error generating embeddings", error: err.message }
            }
        }

        const partEmbeddings = await Promise.all(docParts.map((part, i) => generatePartEmbeddings(part, i)));
        const validPartEmbeddings = partEmbeddings.filter(e => e.result !== null).map(e => e.result);
        const averagedEmbedding = computeAttentionEmbedding(validPartEmbeddings.map(e => e.values));
        log.info(`Averaged embeddings for document ${document.id} in ${(new Date().getTime() - start) / 1000} seconds`, { len: averagedEmbedding.length, count: validPartEmbeddings.length, max_tokens: maxTokens });
        await client.objects.setEmbedding(document.id, type,
            {
                values: averagedEmbedding,
                model: validPartEmbeddings[0].model,
                etag: document.text_etag
            }
        );
        log.info(`Object ${document.id} embedding set`, { type, len: averagedEmbedding.length });

    } else {
        log.info(`Generating ${type} embeddings for document`);

        const res = await generateEmbeddingsFromStudio(JSON.stringify(document[type]), environment, client);
        if (!res || !res.values) {
            return { id: document.id, status: "failed", message: "no embeddings generated" }
        }

        log.info(`${type} embeddings generated for document ${document.id}`, { len: res.values.length });
        await client.objects.setEmbedding(document.id, type,
            {
                values: res.values,
                model: res.model,
                etag: document.text_etag
            }
        );

        return { id: document.id, type, status: "completed", len: res.values.length }

    }

}

async function generateImageEmbeddings({ document, client, type, config }: ExecuteGenerateEmbeddingsParams) {

    log.info('Generating image embeddings for document ' + document.id, { content: document.content });
    if (!document.content?.type?.startsWith('image/') && !document.content?.type?.includes('pdf')) {
        return { id: document.id, type, status: "failed", message: "content is not an image" }
    }
    const { environment, model } = config

    const resRnd = await client.store.objects.getRendition(document.id, {
        format: "image/png",
        max_hw: 1024,
        generate_if_missing: true
    });

    if (resRnd.status === 'generating') {
        throw new Error("Rendition is generating, will retry later")
    } else if (resRnd.status === "failed" || !resRnd.rendition) {
        throw new NoDocumentFound("Rendition retrieval failed", [document.id])
    }

    if (!resRnd.rendition.content.source) {
        throw new NoDocumentFound("No source found in rendition", [document.id])
    }

    const image = await fetchBlobAsBase64(client, resRnd.rendition.content.source);

    const res = await client.environments.embeddings(environment, {
        image,
        model
    }).then(res => res).catch(e => {
        log.error('Error generating embeddings for image', { error: e })
        throw e;
    });

    if (!res || !res.values) {
        return { id: document.id, status: "failed", message: "no embeddings generated" }
    }

    await client.objects.setEmbedding(document.id, SupportedEmbeddingTypes.image,
        {
            values: res.values,
            model: res.model,
            etag: document.text_etag
        }
    );

    return { id: document.id, type, status: "completed", len: res.values.length }

}

async function generateEmbeddingsFromStudio(text: string, env: string, client: VertesiaClient, model?: string): Promise<EmbeddingsResult> {

    log.info(`Generating embeddings for text of ${text.length} chars with environment ${env}`);

    return client.environments.embeddings(env, {
        text,
        model
    }).then(res => res).catch(e => {
        log.error('Error generating embeddings for text', { error: e })
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
    const expWeights = attentionWeights.map(w => Math.exp(w));
    const sumExpWeights = expWeights.reduce((sum, val) => sum + val, 0);
    const attentionScores = expWeights.map(w => w / sumExpWeights);

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
    console.log(`Computed document embedding in ${duration}ms for ${chunkEmbeddings.length} chunks`);

    return documentEmbedding;
}
