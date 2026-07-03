import { ApplicationFailure, log } from '@temporalio/activity';
import {
    type ContentSource,
    type DSLActivityExecutionPayload,
    type DSLActivitySpec,
    type JSONObject,
    PDF_RENDITION_NAME,
    type Rendition,
} from '@vertesia/common';
import { setupActivity } from '../dsl/setup/ActivityContext.js';
import { type TruncateSpec, truncByMaxTokens } from '../utils/tokens.js';
import { executeInteractionFromActivity, type InteractionExecutionParams } from './executeInteraction.js';

const INT_EXTRACT_INFORMATION = 'sys:ExtractInformation';

export type GenerateDocumentPropertiesSource = 'auto' | 'text' | 'vision' | 'mixed';

interface RetryableError extends Error {
    retryable?: boolean;
}

function toRetryableError(error: unknown): RetryableError {
    if (error instanceof Error) {
        return error as RetryableError;
    }
    return new Error(String(error)) as RetryableError;
}

export interface GenerateDocumentPropertiesParams extends InteractionExecutionParams {
    typesHint?: string[];
    /**
     * truncate the input doc text to the specified max_tokens
     */
    truncate?: TruncateSpec;

    interactionName?: string;

    /**
     * @deprecated Use source: 'mixed'. Accepted for backward compatibility with existing DSL callers.
     */
    use_vision?: boolean;

    source?: GenerateDocumentPropertiesSource;

    instructions?: string;
}
export interface GenerateDocumentProperties extends DSLActivitySpec<GenerateDocumentPropertiesParams> {
    name: 'generateDocumentProperties';
}
export type GenerateDocumentPropertiesResult =
    | { status: 'completed' }
    | { status: 'failed'; error: string }
    | { document: string; status: 'skipped'; message: string };

function getPdfRenditionContent(doc: { metadata?: { renditions?: unknown } }): ContentSource | undefined {
    const renditions = doc.metadata?.renditions;
    if (!Array.isArray(renditions)) {
        return undefined;
    }
    const pdfRendition = renditions.find(
        (rendition): rendition is Rendition =>
            typeof rendition === 'object' &&
            rendition !== null &&
            (rendition as { name?: unknown }).name === PDF_RENDITION_NAME &&
            typeof (rendition as { content?: { source?: unknown } }).content?.source === 'string',
    );
    return pdfRendition?.content;
}

export async function generateDocumentProperties(
    payload: DSLActivityExecutionPayload<GenerateDocumentPropertiesParams>,
): Promise<GenerateDocumentPropertiesResult> {
    const context = await setupActivity<GenerateDocumentPropertiesParams>(payload);
    const { params, client, objectId } = context;
    const interactionName = params.interactionName ?? INT_EXTRACT_INFORMATION;

    const project = await context.fetchProject();

    const doc = await client.objects.retrieve(objectId, '+text +metadata +content');
    const type = doc.type ? await client.types.catalog.resolve(doc.type) : undefined;

    if (!type?.object_schema) {
        log.info(`Object ${objectId} has no schema`);
        return { document: objectId, status: 'skipped', message: 'no schema defined on type' };
    }

    const source = params.source ?? (params.use_vision ? 'mixed' : 'auto');
    const getImageRef = (): string | ContentSource | undefined => {
        if (doc.content?.type?.startsWith('image/')) {
            return `store:${doc.id}`;
        }

        if (doc.content?.type?.startsWith('application/pdf')) {
            return `store:${doc.id}`;
        }

        const pdfRendition = getPdfRenditionContent(doc);
        if (pdfRendition?.type?.startsWith('application/pdf')) {
            return pdfRendition;
        }

        log.info(`Object ${objectId} is not an image or pdf`);
        return undefined;
    };

    const hasRealText = !!doc.text?.trim();
    const content =
        hasRealText && (source === 'auto' || source === 'text' || source === 'mixed')
            ? truncByMaxTokens(doc.text ?? '', params.truncate || 30000)
            : undefined;
    const imageRef =
        source === 'vision' || source === 'mixed' || (source === 'auto' && !content) ? getImageRef() : undefined;

    if (!content && !imageRef) {
        log.warn(`Object ${objectId} has no text or supported vision source`);
        return { status: 'failed', error: 'no-source' };
    }

    const promptData = {
        content: content,
        image: imageRef,
        extraction_instructions: params.instructions,
        human_context: project?.configuration?.human_context ?? undefined,
    };

    log.info(
        `Extracting information from object ${objectId} with type ${type.name}`,
        payload.debug_mode ? { params } : undefined,
    );

    let infoRes: Awaited<ReturnType<typeof executeInteractionFromActivity>>;
    try {
        infoRes = await executeInteractionFromActivity(
            client,
            interactionName,
            {
                ...params,
                include_previous_error: true,
                result_schema: type.object_schema,
                validate_result: type.strict_mode,
            },
            promptData,
            payload.debug_mode ?? false,
        );
    } catch (error: unknown) {
        const extractionError = toRetryableError(error);
        log.error(`Failed to extract document properties for ${objectId}`, {
            error: extractionError,
            retryable: extractionError.retryable,
        });

        const isRetryable = extractionError.retryable !== undefined ? extractionError.retryable !== false : undefined;

        if (isRetryable !== undefined) {
            if (isRetryable) {
                throw ApplicationFailure.create({
                    message: `Document property extraction failed for ${objectId}: ${extractionError.message}`,
                    nonRetryable: false,
                });
            } else {
                throw ApplicationFailure.create({
                    message: `Non-retryable document property extraction failed for ${objectId}: ${extractionError.message}`,
                    nonRetryable: true,
                });
            }
        }

        throw error;
    }

    log.info(`Extracted information from object ${objectId} with type ${type.name}`, { runId: infoRes.id });
    await client.objects.update(
        doc.id,
        {
            properties: infoRes.result.object<JSONObject>(),
            generation_run_info: {
                id: infoRes.id,
                date: new Date().toISOString(),
                model: infoRes.modelId ?? '',
            },
        },
        { suppressWorkflows: true },
    );

    return { status: 'completed' };
}
