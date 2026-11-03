import { log } from '@temporalio/activity';
import { RequestError } from '@vertesia/api-fetch-client';
import type {
    ContentObject,
    DSLActivityExecutionPayload,
    DSLActivitySpec,
    PendingRenditionNames,
    Rendition,
} from '@vertesia/common';
import { setupActivity } from '../dsl/setup/ActivityContext.js';
import { WorkflowParamNotFoundError } from '../errors.js';
import { removePendingRendition, updateObjectMetadata, upsertRendition } from '../utils/metadata.js';

export interface AddObjectRenditionParams {
    /**
     * The rendition to store. An existing rendition with the same name is replaced. Null records that the rendition
     * named by `name` is not coming (it was skipped or could not be produced), so readers stop waiting for it.
     */
    rendition?: Rendition | null;
    /** The rendition's name. Required when `rendition` is null; otherwise taken from the rendition. */
    name?: string;
    /** The content etag the rendition was made from. When the content has changed since, nothing is written. */
    etag?: string;
}

export interface AddObjectRendition extends DSLActivitySpec<AddObjectRenditionParams> {
    name: 'addObjectRendition';
}

export interface AddObjectRenditionResult {
    objectId: string;
    /** `added`: the rendition was stored. `cleared`: only its pending mark was removed. `skipped`: nothing written. */
    status: 'added' | 'cleared' | 'skipped';
}

type ObjectMetadata = NonNullable<ContentObject['metadata']>;

/**
 * Add a rendition to an object's metadata, replacing any rendition of the same name, and remove that name from the
 * metadata's pending renditions.
 *
 * Reads the metadata immediately before writing, so values other steps stored meanwhile are kept. It is not a lock:
 * the caller must not run it while another step writes the same object's metadata.
 */
export async function addObjectRendition(
    payload: DSLActivityExecutionPayload<AddObjectRenditionParams>,
): Promise<AddObjectRenditionResult> {
    const { client, objectId, params } = await setupActivity<AddObjectRenditionParams>(payload);
    const { rendition, etag } = params;
    const name = rendition?.name ?? params.name;
    if (!name) {
        throw new WorkflowParamNotFoundError('name');
    }

    let status: AddObjectRenditionResult['status'] = 'skipped';
    try {
        await updateObjectMetadata(
            client,
            objectId,
            (current) => {
                if (etag && current.etag !== etag) {
                    log.info(`Content of ${objectId} changed since the ${name} rendition was made; skipping`);
                    return undefined;
                }
                const metadata = (current.metadata ?? {}) as ObjectMetadata & {
                    renditions?: Rendition[];
                    pending_renditions?: PendingRenditionNames;
                };
                if (!rendition && !metadata.pending_renditions?.names.includes(name)) {
                    return undefined;
                }
                const pending = removePendingRendition(metadata.pending_renditions, name);
                status = rendition ? 'added' : 'cleared';
                return {
                    metadata: {
                        ...metadata,
                        ...(rendition ? { renditions: upsertRendition(metadata.renditions, rendition) } : {}),
                        pending_renditions: pending,
                    },
                };
            },
            etag ? { ifMatch: etag } : undefined,
        );
        return { objectId, status };
    } catch (error) {
        if (error instanceof RequestError && error.status === 412) {
            log.info(`Content of ${objectId} changed while storing the ${name} rendition; skipping`);
            return { objectId, status: 'skipped' };
        }
        throw error;
    }
}
