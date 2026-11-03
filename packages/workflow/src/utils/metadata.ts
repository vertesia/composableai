import type { VertesiaClient } from '@vertesia/client';
import type { ContentObject, PendingRenditionNames, Rendition } from '@vertesia/common';

type ObjectMetadata = NonNullable<ContentObject['metadata']>;
type ObjectUpdate = Parameters<VertesiaClient['objects']['update']>[1];
type ObjectUpdateOptions = NonNullable<Parameters<VertesiaClient['objects']['update']>[2]>;

export interface ObjectMetadataSnapshot {
    /** The object's metadata as stored right now, or `undefined` when it has none. */
    metadata?: ObjectMetadata;
    /** The content etag the metadata belongs to. */
    etag?: string;
}

/**
 * Update an object's metadata from a fresh read of it.
 *
 * The objects API replaces `metadata` as a whole, so a writer that spreads a copy read earlier (before a long-running
 * step, say) silently drops whatever another step stored in between. This reads only `metadata` and `content` (never the
 * text or the source file) immediately before the write and passes them to `build`, which returns the update or
 * `undefined` to skip it. It narrows the window between read and write; it is not a lock, so concurrent writers to one
 * object must still be sequenced by the caller.
 *
 * @returns whether an update was sent
 */
export async function updateObjectMetadata(
    client: VertesiaClient,
    objectId: string,
    build: (current: ObjectMetadataSnapshot) => ObjectUpdate | undefined,
    options?: ObjectUpdateOptions,
): Promise<boolean> {
    const object = await client.objects.retrieve(objectId, 'metadata content');
    const update = build({
        metadata: object.metadata as ObjectMetadata | undefined,
        etag: object.content?.etag,
    });
    if (!update) {
        return false;
    }
    await client.objects.update(objectId, update, options);
    return true;
}

/** Return `renditions` with `rendition` replacing any entry of the same name, or appended when there is none. */
export function upsertRendition<R extends Rendition>(renditions: readonly R[] | undefined, rendition: R): R[] {
    const others = (renditions ?? []).filter((existing) => existing.name !== rendition.name);
    return [...others, rendition];
}

/** The key renditions of an object's current content are stored under: the content etag, or the object id. */
export function renditionStorageKey(object: Pick<ContentObject, 'id' | 'content'>): string {
    return object.content?.etag ?? object.id;
}

/** Return `pending` without `name`, or undefined when no name is left. */
export function removePendingRendition(
    pending: PendingRenditionNames | undefined,
    name: string,
): PendingRenditionNames | undefined {
    if (!pending) {
        return undefined;
    }
    const names = pending.names.filter((pendingName) => pendingName !== name);
    return names.length > 0 ? { ...pending, names } : undefined;
}
