import { log } from '@temporalio/activity';
import { type VertesiaClient, ZenoClientNotFoundError } from '@vertesia/client';
import {
    type ContentObject,
    type DSLActivityExecutionPayload,
    type DSLActivitySpec,
    type EmbeddingsApiResult,
    ImageRenditionFormat,
    type ProjectConfigurationEmbedding,
    SupportedEmbeddingTypes,
} from '@vertesia/common';
import { setupActivity } from '../dsl/setup/ActivityContext.js';
import { DocumentNotFoundError } from '../errors.js';
import { fetchBlobAsBase64, md5 } from '../utils/blobs.js';
import type { DocPart } from '../utils/chunks.js';
import { countTokens } from '../utils/tokens.js';

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
        throw new DocumentNotFoundError('Project not found', [payload.project_id]);
    }
    if (!config) {
        throw new DocumentNotFoundError('Embeddings configuration not found', [objectId]);
    }

    if (!projectData) {
        throw new DocumentNotFoundError('Project not found', [payload.project_id]);
    }

    if (!projectData?.configuration.embeddings[type]?.enabled) {
        log.debug(
            `Embeddings generation disabled for type ${type} on project: ${projectData.name} (${projectData.namespace})`,
            { config },
        );
        return {
            id: objectId,
            status: 'skipped',
            message: `Embeddings generation disabled for type ${type}`,
        };
    }

    log.debug(`${type} embedding generation starting for object ${objectId}`, {
        force,
        config,
    });

    if (!config.environment) {
        throw new Error(
            'No environment found in project configuration. Set environment in project configuration to generate embeddings.',
        );
    }

    let document: Awaited<ReturnType<typeof client.objects.retrieve>>;
    try {
        document = await client.objects.retrieve(objectId, '+text +parts +embeddings +tokens +properties');
    } catch (error) {
        if (error instanceof ZenoClientNotFoundError) {
            throw new DocumentNotFoundError(`Document not found: ${objectId}`, [objectId]);
        }
        throw error;
    }

    if (!document) {
        throw new DocumentNotFoundError('Document not found', [objectId]);
    }

    let res:
        | Awaited<ReturnType<typeof generateTextEmbeddings>>
        | Awaited<ReturnType<typeof generateImageEmbeddings>>
        | { id: string; status: string; message: string };

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
                status: 'failed',
                message: `unsupported embedding type: ${type}`,
            };
    }

    return res;
}

interface ExecuteGenerateEmbeddingsParams {
    document: ContentObject;
    client: VertesiaClient;
    type: SupportedEmbeddingTypes;
    config: ProjectConfigurationEmbedding;
    property?: string;
    force?: boolean;
}

async function generateTextEmbeddings({ document, client, type, config, force }: ExecuteGenerateEmbeddingsParams) {
    if (!document) {
        return { status: 'error', message: 'document is null or undefined' };
    }

    if (type !== SupportedEmbeddingTypes.text && type !== SupportedEmbeddingTypes.properties) {
        return {
            id: document.id,
            status: 'failed',
            message: `unsupported embedding type: ${type}`,
        };
    }

    const sourceText =
        type === SupportedEmbeddingTypes.text
            ? document.text
            : document.properties
              ? JSON.stringify(document.properties)
              : undefined;

    if (!sourceText) {
        return {
            id: document.id,
            type,
            status: 'skipped',
            message: type === SupportedEmbeddingTypes.text ? 'no text found' : 'no properties found',
        };
    }

    const { environment } = config;
    if (!environment) {
        throw new Error(
            'No environment found in project configuration. Set environment in project configuration to generate embeddings.',
        );
    }

    const sourceEtag =
        type === SupportedEmbeddingTypes.text ? (document.text_etag ?? md5(sourceText)) : md5(sourceText);

    // Skip if embeddings already exist with matching etag (unless force=true)
    const existingEmbedding = document.embeddings?.[type];
    if (!force && existingEmbedding?.etag && existingEmbedding.etag === sourceEtag) {
        log.debug(`Skipping ${type} embeddings for document ${document.id} - etag unchanged`);
        return {
            id: document.id,
            type,
            status: 'skipped',
            message: 'embeddings already exist with matching etag',
        };
    }

    // Count tokens if needed, do not rely on existing token count
    const tokenCount = countTokens(sourceText).count;

    const maxTokens = config.max_tokens ?? 8000;

    //generate embeddings for the main doc if document isn't too large
    log.debug(`Generating ${type} embeddings for document ${document.id}`);
    if (tokenCount !== undefined && tokenCount > maxTokens) {
        //TODO: Review strategy for large documents
        log.warn(`Document too large for ${type} embeddings generation, skipping (${tokenCount} tokens)`);
        return {
            id: document.id,
            status: 'skipped',
            message: `${type} embeddings generation, skipped for large document (${tokenCount} tokens)`,
        };
    } else {
        log.debug(`Generating ${type} embeddings for document`);

        const res = await generateEmbeddingsFromStudio(sourceText, environment, client);
        const values = res?.results?.[0]?.outputs?.[0]?.values;
        if (!values) {
            return {
                id: document.id,
                status: 'failed',
                message: 'no embeddings generated',
            };
        }

        log.debug(`${type} embeddings generated for document ${document.id}`, {
            len: values.length,
        });
        await client.objects.setEmbedding(document.id, type, {
            values,
            model: res.model,
            etag: sourceEtag,
        });

        return {
            id: document.id,
            type,
            status: 'completed',
            len: values.length,
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
    log.debug(`Generating image embeddings for document ${document.id}`, {
        content: document.content,
    });
    if (!document.content?.type?.startsWith('image/') && !document.content?.type?.includes('pdf')) {
        return {
            id: document.id,
            type,
            status: 'failed',
            message: 'content is not an image',
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
            status: 'skipped',
            message: 'embeddings already exist with matching etag',
        };
    }

    const { environment, model } = config;
    if (!environment) {
        throw new Error(
            'No environment found in project configuration. Set environment in project configuration to generate embeddings.',
        );
    }

    const resRnd = await client.store.objects.getRendition(document.id, {
        format: ImageRenditionFormat.jpeg,
        generate_if_missing: true,
        sign_url: true,
    });

    if (resRnd.status === 'generating') {
        throw new Error('Rendition is generating, will retry later');
    } else if (resRnd.status === 'failed' || !resRnd.renditions || !resRnd.renditions.length) {
        throw new DocumentNotFoundError('Rendition retrieval failed', [document.id]);
    }

    const renditions = resRnd.renditions;
    if (!renditions?.length) {
        throw new DocumentNotFoundError('No source found in rendition', [document.id]);
    }

    const rendition = renditions[0];
    const image = await fetchBlobAsBase64(client, rendition);

    // TODO(task_type): Document embedding task — image inputs do not carry task_type, but this is a document-indexing call.
    // Revisit if task_type support is added to ImageEmbeddingInput in a later PR.
    const res = await client.environments
        .embeddings(environment, {
            inputs: [
                {
                    type: 'image',
                    source: { base64: image, mime_type: 'image/jpeg' },
                },
            ],
            model,
        })
        .then((res) => res)
        .catch((e) => {
            log.error('Error generating embeddings for image', { error: e });
            throw e;
        });

    const values = res?.results?.[0]?.outputs?.[0]?.values;
    if (!values) {
        return {
            id: document.id,
            status: 'failed',
            message: 'no embeddings generated',
        };
    }

    await client.objects.setEmbedding(document.id, SupportedEmbeddingTypes.image, {
        values,
        model: res.model,
        etag: contentEtag,
    });

    return {
        id: document.id,
        type,
        status: 'completed',
        len: values.length,
    };
}

async function generateEmbeddingsFromStudio(
    text: string,
    env: string,
    client: VertesiaClient,
    model?: string,
): Promise<EmbeddingsApiResult> {
    log.debug(`Generating embeddings for text of ${text.length} chars with environment ${env}`);

    // TODO(task_type): Document embedding task — add task_type: "document" once task_type support is validated end-to-end.
    return client.environments
        .embeddings(env, {
            inputs: [{ type: 'text', text }],
            model,
        })
        .then((res) => res)
        .catch((e) => {
            log.error('Error generating embeddings for text', { error: e });
            throw e;
        });
}
