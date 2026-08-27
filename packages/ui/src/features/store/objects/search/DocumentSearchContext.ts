import type { ZenoClient } from '@vertesia/client';
import type {
    ComplexSearchPayload,
    ComplexSearchQuery,
    ComputedFacetResponse,
    ComputeObjectFacetPayload,
    ContentObjectItemApiResponse,
    FacetBucket,
    FacetSpec,
    ObjectSearchQuery,
} from '@vertesia/common';
import { SharedState, useWatchSharedState } from '@vertesia/ui/core';
import type { SearchInterface } from '@vertesia/ui/features';
import { createContext, useContext } from 'react';

interface DocumentSearchResult {
    objects: ContentObjectItemApiResponse[];
    error?: Error;
    isLoading: boolean;
    hasMore?: boolean;
}

export class DocumentSearch implements SearchInterface {
    collectionId?: string;
    facets = new SharedState<ComputedFacetResponse>({});
    result = new SharedState<DocumentSearchResult>({ objects: [], isLoading: false });
    initialized = false;

    facetSpecs: FacetSpec[] = [];
    query: ComplexSearchQuery = {};

    /**
     * Ids the server confirmed deleted, hidden until the index stops returning them.
     *
     * Deletes reach the search index out of band, so a search issued right after one can still
     * return the object. Without this the row reappears and stays until a manual refresh.
     */
    private deletedIds = new Set<string>();

    /** Objects the server has returned so far, before hiding — `loadMore` pages on this, not on the visible count. */
    private loadedCount = 0;

    constructor(
        public client: ZenoClient,
        public limit = 100,
    ) {}

    withFacets(facets: FacetSpec[]) {
        this.facetSpecs = facets;
        return this;
    }

    get objects() {
        return this.result.value.objects;
    }

    get error() {
        return this.result.value.error;
    }

    get isRunning(): boolean {
        return this.result.value.isLoading;
    }

    get hasMore(): boolean {
        return this.result.value.hasMore || false;
    }

    getFilterValue(name: string) {
        return (this.query as Record<string, unknown>)[name];
    }

    setFilterValue(name: string, value: unknown) {
        (this.query as Record<string, unknown>)[name] = value;
        // search now
        void this.search();
    }

    setDefaultKeys(keys: unknown[]) {
        void keys;
    }

    clearFilters(autoSearch: boolean = true) {
        // Preserve search-related fields when clearing filters
        const { parent, full_text, vector, weights, score_aggregation, dynamic_scaling, limit, all_revisions } =
            this.query;
        this.query = {
            parent,
            ...(full_text !== undefined && { full_text }),
            ...(vector !== undefined && { vector }),
            ...(weights !== undefined && { weights }),
            ...(score_aggregation !== undefined && { score_aggregation }),
            ...(dynamic_scaling !== undefined && { dynamic_scaling }),
            ...(limit !== undefined && { limit }),
            ...(all_revisions !== undefined && { all_revisions }),
        };

        if (autoSearch) {
            void this.search();
        }
    }

    getFacetBuckets(name: string): FacetBucket[] {
        const value = this.facets.value[name];
        return Array.isArray(value) ? value : [];
    }

    resetFacets() {
        this.query = {};
    }

    /**
     * Drop objects the server confirmed deleted, and keep them out of results until the index
     * agrees. Reconciled in `_search`: once a full search stops returning an id, it is really gone
     * and stops being hidden.
     */
    removeDeletedObjects(ids: string[]) {
        if (ids.length === 0) return;
        for (const id of ids) {
            this.deletedIds.add(id);
        }
        const previous = this.result.value;
        const objects = previous.objects.filter((obj) => !this.deletedIds.has(obj.id));
        const removed = previous.objects.length - objects.length;
        this.result.value = { ...previous, objects };

        const facets = this.facets.value;
        if (removed > 0 && typeof facets.total === 'number') {
            this.facets.value = { ...facets, total: Math.max(0, facets.total - removed) };
        }
    }

    reset(isLoading = false) {
        this.initialized = false;
        this.deletedIds.clear();
        this.loadedCount = 0;
        this.result.value = {
            objects: [],
            isLoading,
            hasMore: true,
        };
    }

    _updateRunningState(value: boolean) {
        const prev = this.result.value;
        this.result.value = {
            objects: prev.objects,
            isLoading: value,
            error: prev.error,
            hasMore: prev.hasMore,
        };
    }

    _searchRequest(query: ComplexSearchQuery, limit: number, offset: number, includeFacets: boolean = true) {
        // Keep this as `satisfies`: the full-object overload depends on preserving the literal
        // `select?: undefined` shape rather than widening to a generic ComplexSearchPayload.
        const payload = {
            limit,
            offset,
            query,
            facets: includeFacets ? this.facetSpecs : undefined,
        } satisfies ComplexSearchPayload;

        const request = this.collectionId
            ? this.client.collections.searchMembers(this.collectionId, payload)
            : this.client.objects.search(payload);

        return request;
    }

    _facetsRequest() {
        const payload: ComputeObjectFacetPayload = { facets: this.facetSpecs, query: this.query };
        return this.collectionId
            ? this.client.collections.computeFacets(this.collectionId, payload)
            : this.client.objects.computeFacets(payload);
    }

    computeFacets(_query: ObjectSearchQuery) {
        this._facetsRequest().then((facets) => {
            this.facets.value = facets;
        });
    }

    async _search(loadMore = false, noFacets = false): Promise<boolean> {
        if (this.isRunning && loadMore) {
            return false;
        }
        const previous = this.result.value;
        if (!loadMore) {
            this.initialized = true;
        }
        this.result.value = {
            isLoading: true,
            objects: loadMore ? this.objects : [],
            hasMore: loadMore ? this.result.value.hasMore : true,
        };
        const limit = this.limit;
        const offset = loadMore ? this.loadedCount : 0;
        try {
            const res = await this._searchRequest(this.query, limit, offset, !noFacets);
            // Handle the new format with results and facets
            const results = res.results || [];
            const facets = res.facets || {};

            this.loadedCount = loadMore ? this.loadedCount + results.length : results.length;

            // Only a full search proves an id is gone. A `loadMore` page is a different slice, so an
            // absence there says nothing and must not clear the entry.
            if (!loadMore && this.deletedIds.size > 0) {
                for (const id of [...this.deletedIds]) {
                    if (!results.some((obj) => obj.id === id)) {
                        this.deletedIds.delete(id);
                    }
                }
            }
            const visible = this.deletedIds.size > 0 ? results.filter((obj) => !this.deletedIds.has(obj.id)) : results;

            this.result.value = {
                isLoading: false,
                objects: loadMore ? this.objects.concat(visible) : visible,
                // `results`, not `visible`: paging is the server's page size, not what we show.
                hasMore: results.length === limit,
            };

            // Update facets if they were requested and returned
            if (!noFacets && facets && Object.keys(facets).length > 0) {
                this.facets.value = facets;
            }

            return true;
        } catch (err: unknown) {
            // index_not_found_exception means the data store has no index yet — treat as empty
            if (typeof err === 'object' && err !== null && 'status' in err && err.status === 404) {
                this.result.value = { isLoading: false, objects: [], hasMore: false };
                return false;
            }
            const error = err instanceof Error ? err : new Error(String(err));
            this.result.value = {
                error,
                isLoading: false,
                objects: previous.objects,
                hasMore: false,
            };
            return false;
        }
    }

    search(noFacets = false) {
        if (this.isRunning) {
            return Promise.resolve(false);
        }
        return this._search(false, noFacets);
    }

    loadMore(noFacets = false) {
        if (this.isRunning || !this.hasMore) return Promise.resolve(false);
        if (this.query.vector) return Promise.resolve(false); //Load more not supported on vector queries
        if (this.objects.length > 0) {
            noFacets = true; //Only reload facets on loadMore if there are no results.
        }
        return this._search(true, noFacets);
    }
}

const DocumentSearchContext = createContext<DocumentSearch | undefined>(undefined);

export function useDocumentSearch() {
    // biome-ignore lint/style/noNonNullAssertion: intentionally tolerant — called outside its Provider by shared toolbars/action menus (e.g. on the object-detail page) where the context is undefined and callers handle it; throwing here crashes those pages (regressed in PR #6024)
    return useContext(DocumentSearchContext)!;
}

export function useWatchDocumentSearchFacets() {
    return useWatchSharedState(useDocumentSearch().facets);
}

export function useWatchDocumentSearchResult() {
    const search = useDocumentSearch();
    const result = useWatchSharedState(search.result);
    return { ...result, search };
}

export function useDocumentSearchCount() {
    const search = useDocumentSearch();
    const result = useWatchSharedState(search.facets);
    return result.total;
}

export { DocumentSearchContext as SearchContext };
