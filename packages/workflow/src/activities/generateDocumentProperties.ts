import { ApplicationFailure, log } from '@temporalio/activity';
import {
    type ContentMetadata,
    type ContentSource,
    type DSLActivityExecutionPayload,
    type DSLActivitySpec,
    type JSONObject,
    PDF_RENDITION_NAME,
    type Rendition,
} from '@vertesia/common';
import { setupActivity } from '../dsl/setup/ActivityContext.js';
import { md5 } from '../utils/blobs.js';
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

    /**
     * Scoped page-image evidence prepared by intake (`prepareVisionEvidence` scratch refs).
     * When the param is PRESENT (even as an empty array) and the source calls for visual
     * evidence, these refs are the ONLY visual evidence used — never the whole-object
     * `store:{id}` ref, which resolves to ALL pages near-full-res through the rendition
     * generate-and-poll path. An empty array means intake prepared no usable evidence
     * (budget-impossible or no renderable source): extraction then runs text-only or fails
     * with no-source instead of shipping an over-budget payload.
     * Absent = legacy behavior for existing DSL callers.
     */
    evidence_images?: ContentSource[];

    /**
     * Opt-in freshness guard. When true, the activity computes a fingerprint of the extraction
     * inputs (content etag, type + its object schema, source, instructions, interaction name)
     * and returns `{ status: 'skipped' }` without executing the interaction when the fingerprint
     * stored by a previous successful extraction matches and the object already has non-empty
     * properties. Defaults to false so shared DSL callers keep the always-extract behavior.
     * `payload.vars.forceGeneration` bypasses the skip.
     */
    skip_if_fresh?: boolean;
}
export interface GenerateDocumentProperties extends DSLActivitySpec<GenerateDocumentPropertiesParams> {
    name: 'generateDocumentProperties';
}
export type GenerateDocumentPropertiesResult =
    | { status: 'completed' }
    | { status: 'failed'; error: string }
    | { document: string; status: 'skipped'; message: string };

/**
 * Stable fingerprint of the inputs that determine the extraction output. Key order is fixed by
 * the object literal so the hash is deterministic.
 */
export function computeExtractionFingerprint(input: {
    content_etag?: string;
    type_id?: string;
    source: GenerateDocumentPropertiesSource;
    instructions?: string;
    interactionName: string;
    /** The type's object_schema: a schema edit under the same type id must invalidate the fingerprint. */
    object_schema?: unknown;
    /** Scoped vision evidence refs: a different page/profile selection must invalidate the fingerprint.
     *  Undefined (legacy callers) keeps previously stored hashes valid. */
    evidence?: string[];
    /** The object's text etag: text can change under the same content etag (re-render,
     *  re-conversion, manual edit) and text-consuming extractions must invalidate.
     *  Undefined (vision-only callers) keeps previously stored hashes valid. */
    text_etag?: string | null;
}): string {
    return md5(
        JSON.stringify({
            content_etag: input.content_etag,
            type_id: input.type_id,
            source: input.source,
            instructions: input.instructions,
            interactionName: input.interactionName,
            object_schema: input.object_schema,
            ...(input.evidence ? { evidence: input.evidence } : {}),
            ...(input.text_etag !== undefined ? { text_etag: input.text_etag } : {}),
        }),
    );
}

/**
 * The fingerprint is persisted inside the generation run info of the last successful extraction
 * (the server appends it to `metadata.generation_runs`). Other writers append runs without a
 * fingerprint, so scan backwards for the most recent extraction entry.
 */
function getStoredExtractionFingerprint(metadata: ContentMetadata | undefined): string | undefined {
    const runs = metadata?.generation_runs;
    if (!Array.isArray(runs)) {
        return undefined;
    }
    for (let i = runs.length - 1; i >= 0; i--) {
        if (runs[i]?.extraction_fingerprint) {
            return runs[i].extraction_fingerprint;
        }
    }
    return undefined;
}

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
    const evidenceProvided = Array.isArray(params.evidence_images);
    const evidenceImages = params.evidence_images?.length ? params.evidence_images : undefined;

    const extractionFingerprint = computeExtractionFingerprint({
        content_etag: doc.content?.etag,
        type_id: type.id,
        source,
        instructions: params.instructions,
        interactionName,
        object_schema: type.object_schema,
        evidence: evidenceImages?.map((image) => image.source ?? image.name ?? ''),
        // text may change under the same content etag; only vision-only extraction ignores it
        text_etag: source === 'vision' ? undefined : (doc.text_etag ?? null),
    });

    if (params.skip_if_fresh && !payload.vars?.forceGeneration) {
        const storedFingerprint = getStoredExtractionFingerprint(doc.metadata);
        const hasProperties = !!doc.properties && Object.keys(doc.properties).length > 0;
        if (storedFingerprint === extractionFingerprint && hasProperties) {
            log.info(`Skipping property extraction for ${objectId}: extraction inputs unchanged`, {
                extractionFingerprint,
            });
            return {
                document: objectId,
                status: 'skipped',
                message: 'properties are fresh (extraction fingerprint matches)',
            };
        }
    }

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
    const needsVisualEvidence = source === 'vision' || source === 'mixed' || (source === 'auto' && !content);
    // Scoped scratch page refs win over the whole-object store: ref (which resolves to ALL
    // pages near-full-res through the rendition generate-and-poll path). A PRESENT param —
    // even empty — disables the store-ref fallback entirely: intake decided what evidence
    // (if any) may be sent.
    const scopedImages = needsVisualEvidence ? evidenceImages : undefined;
    const imageRef = needsVisualEvidence && !evidenceProvided ? getImageRef() : undefined;

    if (!content && !imageRef && !scopedImages) {
        log.warn(`Object ${objectId} has no text or supported vision source`);
        return { status: 'failed', error: 'no-source' };
    }

    const promptData = {
        content: content,
        image: imageRef,
        images: scopedImages,
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
                extraction_fingerprint: extractionFingerprint,
            },
        },
        { suppressWorkflows: true },
    );

    return { status: 'completed' };
}
