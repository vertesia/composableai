import type { JSONSchema } from '@llumiverse/common';
import { ApplicationFailure, log } from '@temporalio/activity';
import {
    type ContentObjectTypeItem,
    type ContentSource,
    type CreateContentObjectTypePayload,
    type DSLActivityExecutionPayload,
    type DSLActivitySpec,
    ImageRenditionFormat,
    PDF_RENDITION_NAME,
    type Rendition,
} from '@vertesia/common';
import { type ActivityContext, setupActivity } from '../dsl/setup/ActivityContext.js';
import { type TruncateSpec, truncByMaxTokens } from '../utils/tokens.js';
import { executeInteractionFromActivity, type InteractionExecutionParams } from './executeInteraction.js';

const INT_SELECT_DOCUMENT_TYPE = 'sys:SelectDocumentType';
const INT_GENERATE_METADATA_MODEL = 'sys:GenerateMetadataModel';

// Always-present system fallback type (registered in zeno's SystemContentTypeRegistry). When type
// selection finds no existing match and new-type generation is disabled, documents are assigned
// this generic type so they still get a minimal property set + a processing hint for later typing.
const GENERIC_DOCUMENT_TYPE_ID = 'sys:GenericDocument';
const GENERIC_DOCUMENT_TYPE_NAME = 'GenericDocument';

interface RetryableError extends Error {
    retryable?: boolean;
}

interface SelectDocumentTypeResult {
    document_type?: string;
}

interface GeneratedDocumentTypeResult {
    document_type?: string;
    document_type_description?: string;
    metadata_schema?: CreateContentObjectTypePayload['object_schema'];
    is_chunkable?: boolean;
    table_layout?: CreateContentObjectTypePayload['table_layout'];
}

function toRetryableError(error: unknown): RetryableError {
    if (error instanceof Error) {
        return error as RetryableError;
    }
    return new Error(String(error)) as RetryableError;
}

export interface GenerateOrAssignContentTypeParams extends InteractionExecutionParams {
    typesHint?: string[];
    /**
     * truncate the input doc text to the specified max_tokens
     */
    truncate?: TruncateSpec;

    /**
     * The name of the interaction to execute
     * @default SelectDocumentType
     */
    interactionNames?: {
        selectDocumentType?: string;
        generateMetadataModel?: string;
    };

    /**
     * Whether the activity may create a brand-new content type when no existing type matches.
     * Defaults to true for backward compatibility.
     */
    allowNewContentTypes?: boolean;

    /**
     * Type id to assign when no existing type matches and generation is disabled. Resolved in this
     * project; falls back to sys:GenericDocument if unset or unresolvable.
     */
    fallbackTypeId?: string;
}

export interface GenerateOrAssignContentType extends DSLActivitySpec<GenerateOrAssignContentTypeParams> {
    name: 'generateOrAssignContentType';
}

export type GenerateOrAssignContentTypeResult =
    | {
          status: 'skipped';
          message: string;
      }
    | {
          status: 'failed';
          error: 'no-text';
      }
    | {
          id: string;
          name: string;
          isNew: boolean;
      };

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

export async function generateOrAssignContentType(
    payload: DSLActivityExecutionPayload<GenerateOrAssignContentTypeParams>,
): Promise<GenerateOrAssignContentTypeResult> {
    const context = await setupActivity<GenerateOrAssignContentTypeParams>(payload);
    const { params, client, objectId } = context;

    const interactionName = params.interactionNames?.selectDocumentType ?? INT_SELECT_DOCUMENT_TYPE;

    log.debug(`SelectDocumentType for object: ${objectId}`, { payload });

    const object = await client.objects.retrieve(objectId, '+text +metadata +content');

    //Expects object.type to be null on first ingestion of content
    //User initiated Content Type change via the Composable UI,
    //sets object.type to null when they let Composable choose for them.
    //sets object.type to chosen type (thus non-null) when user picks a type.
    if (object.type) {
        log.warn(`Object ${objectId} has already a type. Skipping type creation.`);
        return {
            status: 'skipped',
            message: `Object already has a type: ${object.type.name}`,
        };
    }

    const pdfRendition = getPdfRenditionContent(object);
    const hasVisionSource =
        object.content?.type?.startsWith('image/') ||
        object.content?.type?.startsWith('application/pdf') ||
        !!pdfRendition?.type?.startsWith('application/pdf');

    if (!object || (!object.text && !hasVisionSource)) {
        log.info(`Object ${objectId} not found or text is empty and not an image`, {
            object,
        });
        return { status: 'failed', error: 'no-text' };
    }

    const types = await client.types.catalog.list({
        schema: true,
    });

    //make a list of all existing types, and add hints if any
    const existing_types = types.filter((t) => !['DocumentPart', 'Rendition'].includes(t.name) && t.status !== 'draft');
    const content = object.text ? truncByMaxTokens(object.text, params.truncate || 30000) : undefined;

    const getImage = async (): Promise<string | ContentSource | undefined> => {
        if (pdfRendition?.type?.startsWith('application/pdf')) {
            return pdfRendition;
        }
        if (object.content?.type?.includes('pdf') && object.text?.length && object.text?.length < 100) {
            return `store:${objectId}`;
        }
        if (!object.content?.type?.startsWith('image/')) {
            return undefined;
        }
        const res = await client.objects.getRendition(objectId, {
            format: ImageRenditionFormat.jpeg,
            generate_if_missing: true,
        });
        if (!res.renditions?.length && res.status === 'generating') {
            //throw to try again
            throw new Error(`Rendition for object ${objectId} is in progress`);
        } else if (res.renditions) {
            return `store:${objectId}`;
        }
    };

    const fileRef = await getImage();

    // Slim catalog for the selection prompt: names + identification guidance only, NO schemas
    // (design intake-v2 §3). The full list (with schemas) is still used for matching and for
    // new-type generation below.
    const selectionCatalog = existing_types.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        guidance: t.intake?.identification?.guidance,
        distinguish_from: t.intake?.identification?.distinguish_from,
    }));

    // Closed-world output: constrain the result to the eligible type names + 'other', which
    // removes the exact-string-match fragility on the model's answer.
    const selectionResultSchema: JSONSchema = {
        type: 'object',
        properties: {
            document_type: {
                type: 'string',
                enum: [...existing_types.map((t) => t.name), 'other'],
                description: "Name of the matching document type, or 'other' when none matches.",
            },
        },
        required: ['document_type'],
    };

    log.info(
        'Execute SelectDocumentType interaction on content with \nexisting types - passing slim catalog: ' +
            existing_types.filter((t) => !t.tags?.includes('system')).map((t) => t.name),
    );

    let res: Awaited<ReturnType<typeof executeInteractionFromActivity>>;
    try {
        res = await executeInteractionFromActivity(
            client,
            interactionName,
            { ...params, result_schema: selectionResultSchema },
            {
                existing_types: selectionCatalog,
                content,
                image: fileRef,
            },
        );
    } catch (error: unknown) {
        const selectionError = toRetryableError(error);
        log.error(`Failed to select document type`, { error: selectionError, retryable: selectionError.retryable });

        const isRetryable = selectionError.retryable !== undefined ? selectionError.retryable !== false : undefined;

        if (isRetryable !== undefined) {
            if (isRetryable) {
                throw ApplicationFailure.create({
                    message: `Document type selection failed: ${selectionError.message}`,
                    nonRetryable: false,
                });
            } else {
                throw ApplicationFailure.create({
                    message: `Non-retryable document type selection failed: ${selectionError.message}`,
                    nonRetryable: true,
                });
            }
        }

        throw error;
    }

    const jsonResult = res.result.object<SelectDocumentTypeResult>();

    log.debug(`Selected Content Type Result: ${JSON.stringify(jsonResult)}`);

    //if type is not identified or not present in the database, generate a new type
    let selectedType: { id: string; name: string; isNew: boolean } | undefined;

    const existingMatch = existing_types.find((t) => t.name === jsonResult.document_type);
    if (existingMatch) {
        selectedType = { id: existingMatch.id, name: existingMatch.name, isNew: false };
    }

    if (!selectedType) {
        if (params.allowNewContentTypes === false) {
            // Type generation is disabled (handled separately, e.g. via the Studio Assistant), so
            // fall back to the project's default type (or sys:GenericDocument) rather than leaving
            // the document untyped. 'other' is the constrained schema's first-class no-match
            // answer, not a selection defect — only warn on anything else.
            if (jsonResult.document_type && jsonResult.document_type !== 'other') {
                log.warn('Document type selection returned an ineligible or unknown type; assigning fallback', {
                    objectId,
                    selectedDocumentType: jsonResult.document_type,
                    eligibleTypes: existing_types.map((type) => type.name),
                });
            }
            selectedType = await resolveFallbackType(context, params.fallbackTypeId, jsonResult.document_type);
        } else {
            log.warn('Document type not identified: starting type generation');
            const newType = await generateNewType(context, existing_types, content, fileRef);
            selectedType = { id: newType.id, name: newType.name, isNew: true };
        }
    }

    if (!selectedType) {
        log.error('Type not found: ', res.result);
        throw new Error(`Type not found: ${jsonResult.document_type}`);
    }

    // Update object with selected type. Suppress workflow triggers: this is an intake-internal
    // self-write — type updates now emit dirty.type and match the StandardIntake trigger, so an
    // unsuppressed write here would recursively re-run intake on every type assignment.
    await client.objects.update(
        objectId,
        {
            type: selectedType.id,
        },
        { suppressWorkflows: true },
    );

    return {
        id: selectedType.id,
        name: selectedType.name,
        isNew: selectedType.isNew,
    };
}

/**
 * Resolve the fallback type to assign when selection finds no match: the project's configured
 * default content type if set and resolvable, otherwise the platform sys:GenericDocument.
 */
async function resolveFallbackType(
    context: ActivityContext<GenerateOrAssignContentTypeParams>,
    fallbackTypeId: string | undefined,
    selectedDocumentType: unknown,
): Promise<{ id: string; name: string; isNew: false }> {
    if (fallbackTypeId && fallbackTypeId !== GENERIC_DOCUMENT_TYPE_ID) {
        try {
            const resolved = await context.client.types.catalog.resolve(fallbackTypeId);
            log.info('Document type not identified; assigning project default content type', {
                fallbackTypeId,
                selectedDocumentType,
            });
            return { id: resolved.id ?? fallbackTypeId, name: resolved.name ?? fallbackTypeId, isNew: false };
        } catch (error) {
            log.warn('Configured default content type not resolvable; using GenericDocument', {
                fallbackTypeId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    log.info('Document type not identified; assigning GenericDocument fallback', { selectedDocumentType });
    return { id: GENERIC_DOCUMENT_TYPE_ID, name: GENERIC_DOCUMENT_TYPE_NAME, isNew: false };
}

async function generateNewType(
    context: ActivityContext<GenerateOrAssignContentTypeParams>,
    existing_types: ContentObjectTypeItem[],
    content?: string,
    fileRef?: string | ContentSource,
) {
    const { client, params } = context;

    const project = await context.fetchProject();
    const interactionName = params.interactionNames?.generateMetadataModel ?? INT_GENERATE_METADATA_MODEL;

    let genTypeRes: Awaited<ReturnType<typeof executeInteractionFromActivity>>;
    try {
        genTypeRes = await executeInteractionFromActivity(client, interactionName, params, {
            existing_types,
            content: content,
            human_context: project?.configuration?.human_context ?? undefined,
            image: fileRef ? fileRef : undefined,
        });
    } catch (error: unknown) {
        const generationError = toRetryableError(error);
        log.error(`Failed to generate new document type`, {
            error: generationError,
            retryable: generationError.retryable,
        });

        const isRetryable = generationError.retryable !== undefined ? generationError.retryable !== false : undefined;

        if (isRetryable !== undefined) {
            if (isRetryable) {
                throw ApplicationFailure.create({
                    message: `Document type generation failed: ${generationError.message}`,
                    nonRetryable: false,
                });
            } else {
                throw ApplicationFailure.create({
                    message: `Non-retryable document type generation failed: ${generationError.message}`,
                    nonRetryable: true,
                });
            }
        }

        throw error;
    }

    const jsonResult = genTypeRes.result.object<GeneratedDocumentTypeResult>();

    if (!jsonResult.document_type) {
        log.error('No name generated for type', genTypeRes);
        throw new Error('No name generated for type');
    }

    log.info('Generated schema for type', jsonResult.metadata_schema);
    const typeData: CreateContentObjectTypePayload = {
        name: jsonResult.document_type,
        description: jsonResult.document_type_description,
        object_schema: jsonResult.metadata_schema,
        is_chunkable: jsonResult.is_chunkable,
        table_layout: jsonResult.table_layout,
    };

    const type = await client.types.create(typeData);

    return type;
}
