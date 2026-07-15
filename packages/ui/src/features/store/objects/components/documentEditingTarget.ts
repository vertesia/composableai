import type { ContentObject, ContentObjectItem, ContentObjectTextResponse } from '@vertesia/common';

export interface DocumentEditingTargetApi {
    retrieve(id: string): Promise<ContentObject>;
    getRevisions(id: string): Promise<ContentObjectItem[]>;
    getObjectText(id: string): Promise<ContentObjectTextResponse>;
}

export interface ResolvedDocumentEditingTarget {
    id: string;
    etag: string;
    content: string;
}

export class DocumentEditingTargetError extends Error {
    constructor(message: string, cause?: unknown) {
        super(message, cause === undefined ? undefined : { cause });
        this.name = 'DocumentEditingTargetError';
    }
}

/**
 * Resolve the current head and load its write precondition and text as one unit.
 * Nothing from a historical revision is returned when the head cannot be proven.
 */
export async function resolveDocumentEditingTarget(
    objects: DocumentEditingTargetApi,
    requestedDocumentId: string,
): Promise<ResolvedDocumentEditingTarget> {
    const requestedObject = await objects.retrieve(requestedDocumentId);
    let targetObject = requestedObject;
    const resolvingHistoricalRevision = Boolean(requestedObject.revision && !requestedObject.revision.head);

    if (resolvingHistoricalRevision) {
        const revisions = await objects.getRevisions(requestedObject.id);
        const heads = revisions.filter((revision) => revision.revision?.head === true);
        if (heads.length !== 1) {
            throw new DocumentEditingTargetError(
                `Expected one head revision for document ${requestedDocumentId}, found ${heads.length}`,
            );
        }
        targetObject = await objects.retrieve(heads[0].id);
        if (targetObject.revision?.head !== true) {
            throw new DocumentEditingTargetError(`Resolved document ${targetObject.id} is no longer the current head`);
        }
    }

    const etag = targetObject.content?.etag;
    if (!etag) {
        throw new DocumentEditingTargetError(`Document ${targetObject.id} has no content ETag`);
    }

    const response = await objects.getObjectText(targetObject.id);
    if (typeof response.text !== 'string') {
        throw new DocumentEditingTargetError(`Document ${targetObject.id} has no text content`);
    }

    return {
        id: targetObject.id,
        etag,
        content: response.text,
    };
}
