import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type { Collection, ContentObject, ContentObjectItem } from '@vertesia/common';

/** A project sharing content with the caller. */
export interface SharedProjectRef {
    id: string;
    name: string;
}

/** A lightweight entry in a shared browse listing (root list or collection members). */
export interface SharedContentEntry {
    type: 'object' | 'collection';
    id: string;
    title: string;
    modified_at: string;
}

/** A shared collection plus its member listing — the default drill-in response. */
export type SharedCollectionView = Collection & { members?: SharedContentEntry[] };

/** Result of resolving a bare content id: the entity, its type, and the project it lives in. */
export type ResolvedContent =
    | { type: 'object'; projectId: string; entity: ContentObject }
    | { type: 'collection'; projectId: string; entity: Collection };

/** A cross-project search hit, stamped with its owner project and relevance score. */
export type ContentSearchHit = ContentObjectItem & { projectId: string; score: number };

/**
 * Read-only client for the `/api/content` namespace: browse and read content shared by other
 * projects in the account, resolve a bare content id, and search across the caller's reachable
 * content (current project + shared projects). There are no write operations.
 */
export class ContentApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/content');
    }

    /** The projects sharing content with the caller (`{ id, name }`). */
    listSharedProjects(): Promise<SharedProjectRef[]> {
        return this.get('/shared');
    }

    /** Root shared entries (shared collections + root shared objects) of a shared project. */
    sharedRoots(projectId: string): Promise<SharedContentEntry[]> {
        return this.get(`/shared/${projectId}`);
    }

    /**
     * Read a shared entity in a shared project. An object id → the full object; a collection id →
     * the collection meta plus its shared members, or meta only with `{ members: false }`.
     */
    getShared(
        projectId: string,
        id: string,
        options?: { members?: boolean },
    ): Promise<ContentObject | SharedCollectionView> {
        return this.get(`/shared/${projectId}/${id}`, {
            query: options?.members === false ? { members: 'false' } : undefined,
        });
    }

    /**
     * Resolve a bare content id when the project is unknown — the current project is checked first,
     * then the shared projects. Returns the entity, its type, and the resolved projectId.
     */
    resolve(objectId: string): Promise<ResolvedContent> {
        return this.get(`/resolve/${objectId}`);
    }

    /**
     * Search content reachable by the caller (current project + shared projects). `onlyShared` drops
     * the current project; `q` is the full-text query; `from`/`limit` paginate. Each hit is stamped
     * with its owner projectId.
     */
    search(options?: { q?: string; onlyShared?: boolean; from?: number; limit?: number }): Promise<ContentSearchHit[]> {
        return this.get('/search', {
            query: {
                q: options?.q,
                onlyShared: options?.onlyShared ? 'true' : undefined,
                from: options?.from,
                limit: options?.limit,
            },
        });
    }
}
