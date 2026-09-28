import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    Collection,
    ComplexSearchPayload,
    ComputedFacetResponse,
    ContentObject,
    ContentObjectItem,
} from '@vertesia/common';

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

/** Result of resolving a bare content id: the entity, its type, and the project it lives in. */
export type ResolvedContent =
    | { type: 'object'; projectId: string; entity: ContentObject }
    | { type: 'collection'; projectId: string; entity: Collection };

/** A cross-project search hit, stamped with its owner project and relevance score. */
export type ContentSearchHit = ContentObjectItem & { projectId: string; score: number };

/** Which projects a cross-project content search covered. */
export interface SharedSearchCoverage {
    /** 'hybrid' when vector search ran on at least one field, otherwise 'text'. */
    mode: 'text' | 'hybrid';
    /** Project ids actually searched — full-text spans every reachable project. */
    searched: string[];
    /** Reachable project ids excluded from the vector pass as embedding-incompatible (hybrid only). */
    vectorIncompatible: string[];
}

/**
 * Response of the cross-project content search: the hits plus `coverage`. This is an object envelope —
 * distinct from the plain array returned by the single-project object search — so callers can tell the
 * two apart (array = project search, `{ results, coverage }` = cross-project search).
 */
export interface ContentSearchResponse {
    results: ContentSearchHit[];
    /** Facets computed across every reachable project. */
    facets: ComputedFacetResponse;
    coverage: SharedSearchCoverage;
}

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

    /**
     * Shared COLLECTIONS at a browse level — the root collections of a shared project (no `parentId`),
     * or the sub-collections of `parentId` within it. Bounded set, returned in full, newest first.
     */
    sharedCollections(projectId: string, parentId?: string): Promise<SharedContentEntry[]> {
        const path = parentId ? `/shared/${projectId}/${parentId}` : `/shared/${projectId}`;
        return this.get(path, { query: { list: 'collections' } });
    }

    /**
     * A page of shared OBJECTS at a browse level — the root objects of a shared project (no `parentId`),
     * or the member objects of `parentId` within it. Paginated via `from`/`limit`, newest first.
     */
    sharedObjects(
        projectId: string,
        parentId?: string,
        options?: { from?: number; limit?: number },
    ): Promise<SharedContentEntry[]> {
        const path = parentId ? `/shared/${projectId}/${parentId}` : `/shared/${projectId}`;
        return this.get(path, { query: { list: 'objects', from: options?.from, limit: options?.limit } });
    }

    /** Read a shared entity's detail: an object id → the full object; a collection id → its meta. */
    getShared(projectId: string, id: string): Promise<ContentObject | Collection> {
        return this.get(`/shared/${projectId}/${id}`);
    }

    /**
     * Resolve a bare content id when the project is unknown — the current project is checked first,
     * then the shared projects. Returns the entity, its type, and the resolved projectId.
     */
    resolve(objectId: string): Promise<ResolvedContent> {
        return this.get(`/resolve/${objectId}`);
    }

    /**
     * Search content reachable by the caller (current project + shared projects). Takes the same
     * `ComplexSearchPayload` as `objects.search` — full-text, vector/hybrid, filters and facets — applied
     * across every reachable project (vector runs only over embedding-compatible ones). `onlyShared` drops
     * the current project. Pagination (`payload.limit`/`offset`) is text-only; a vector/hybrid run returns
     * a top-N window. Returns `{ results, facets, coverage }` — each hit stamped with its owner projectId,
     * plus which projects were searched vs. excluded from the vector pass.
     */
    search(payload: ComplexSearchPayload, options?: { onlyShared?: boolean }): Promise<ContentSearchResponse> {
        return this.post('/search', {
            payload,
            query: { onlyShared: options?.onlyShared ? 'true' : undefined },
        });
    }

    /**
     * The CURRENT project's shared roots (collections + documents) — the Manage view. Requires
     * content-admin. Unshare an entry via the regular collection/object update with `shared_root: false`.
     */
    managed(): Promise<SharedContentEntry[]> {
        return this.get('/managed');
    }
}
