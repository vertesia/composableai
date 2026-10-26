import { log } from '@temporalio/activity';
import { RequestError } from '@vertesia/api-fetch-client';
import type { ContentObject, DSLActivityExecutionPayload, DSLActivitySpec, Rendition } from '@vertesia/common';
import { setupActivity } from '../dsl/setup/ActivityContext.js';
import { updateObjectMetadata, upsertRendition } from '../utils/metadata.js';

export interface AddObjectRenditionParams {
    /** The rendition to store. An existing rendition with the same name is replaced. */
    rendition: Rendition;
    /** The content etag the rendition was made from. When the content has changed since, the rendition is dropped. */
    etag?: string;
}

export interface AddObjectRendition extends DSLActivitySpec<AddObjectRenditionParams> {
    name: 'addObjectRendition';
}

export interface AddObjectRenditionResult {
    objectId: string;
    status: 'added' | 'skipped';
}

type ObjectMetadata = NonNullable<ContentObject['metadata']>;

/**
 * Add a rendition to an object's metadata, replacing any rendition of the same name.
 *
 * Reads the metadata immediately before writing, so values other steps stored meanwhile are kept. It is not a lock:
 * the caller must not run it while another step writes the same object's metadata.
 */
export async function addObjectRendition(
    payload: DSLActivityExecutionPayload<AddObjectRenditionParams>,
): Promise<AddObjectRenditionResult> {
    const { client, objectId, params } = await setupActivity<AddObjectRenditionParams>(payload);
    const { rendition, etag } = params;

    try {
        const updated = await updateObjectMetadata(
            client,
            objectId,
            (current) => {
                if (etag && current.etag !== etag) {
                    log.info(`Content of ${objectId} changed since the ${rendition.name} rendition was made; skipping`);
                    return undefined;
                }
                const metadata = (current.metadata ?? {}) as ObjectMetadata & { renditions?: Rendition[] };
                return {
                    metadata: { ...metadata, renditions: upsertRendition(metadata.renditions, rendition) },
                };
            },
            etag ? { ifMatch: etag } : undefined,
        );
        return { objectId, status: updated ? 'added' : 'skipped' };
    } catch (error) {
        if (error instanceof RequestError && error.status === 412) {
            log.info(`Content of ${objectId} changed while adding the ${rendition.name} rendition; skipping`);
            return { objectId, status: 'skipped' };
        }
        throw error;
    }
}
