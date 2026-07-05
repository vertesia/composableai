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

    reset(isLoading = false) {
        this.initialized = false;
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
        const payload: ComplexSearchPayload = {
            limit,
            offset,
            query,
            facets: includeFacets ? this.facetSpecs : undefined,
        };

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
        const offset = loadMore ? this.objects.length : 0;
        try {
            const res = await this._searchRequest(this.query, limit, offset, !noFacets);
            // Handle the new format with results and facets
            const results = res.results || [];
            const facets = res.facets || {};

            this.result.value = {
                isLoading: false,
                objects: loadMore ? this.objects.concat(results) : results,
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
    const context = useContext(DocumentSearchContext);
    if (!context) {
        throw new Error('useDocumentSearch must be used within DocumentSearchContext.Provider');
    }
    return context;
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
