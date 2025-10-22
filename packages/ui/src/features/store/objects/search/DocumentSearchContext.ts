import { createContext, useContext } from 'react';

import { SharedState, useWatchSharedState } from '@vertesia/ui/core';
import { ComputeFacetsResponse, ZenoClient } from '@vertesia/client';
import { ComplexSearchPayload, ComplexSearchQuery, ComputeObjectFacetPayload, ContentObjectItem, FacetBucket, FacetSpec, ObjectSearchQuery } from '@vertesia/common';
import { SearchInterface } from '@vertesia/ui/features'

interface DocumentSearchResult {
    objects: ContentObjectItem[],
    error?: Error;
    isLoading: boolean;
    hasMore?: boolean;
}


export class DocumentSearch implements SearchInterface {

    collectionId?: string;
    facets = new SharedState<ComputeFacetsResponse>({});
    result = new SharedState<DocumentSearchResult>({ objects: [], isLoading: false });

    facetSpecs: FacetSpec[] = [];
    query: ComplexSearchQuery = {};

    constructor(public client: ZenoClient, public limit = 100) { }

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
        return (this.query as any)[name];
    }

    setFilterValue(name: string, value: any) {
        (this.query as any)[name] = value;
        // search now
        this.search();
    }

    setDefaultKeys(keys: any[]) {
        void keys;
    }

    clearFilters(autoSearch: boolean = true) {
        // Preserve search-related fields when clearing filters
        const { parent, full_text, vector, weights, score_aggregation, dynamic_scaling, limit, all_revisions } = this.query;
        this.query = {
            parent,
            ...(full_text !== undefined && { full_text }),
            ...(vector !== undefined && { vector }),
            ...(weights !== undefined && { weights }),
            ...(score_aggregation !== undefined && { score_aggregation }),
            ...(dynamic_scaling !== undefined && { dynamic_scaling }),
            ...(all_revisions !== undefined && { all_revisions }),
            ...(limit !== undefined && { limit })
        };

        if (autoSearch) {
            this.search();
        }
    }

    getFacetBuckets(name: string): FacetBucket[] {
        return (this.facets.value as any)[name]?.buckets || [];
    }

    resetFacets() {
        this.query = {};
    }

    reset(isLoading = false) {
        this.result.value = {
            objects: [],
            isLoading,
            hasMore: true
        };
    }

    _updateRunningState(value: boolean) {
        const prev = this.result.value;
        this.result.value = {
            objects: prev.objects,
            isLoading: value,
            error: prev.error,
            hasMore: prev.hasMore
        }
    }

    _searchRequest(query: ComplexSearchQuery, limit: number, offset: number, includeFacets: boolean = true) {
        const payload: ComplexSearchPayload = {
            limit,
            offset,
            query,
            facets: includeFacets ? this.facetSpecs : undefined
        };

        const request = this.collectionId ?
            this.client.collections.searchMembers(this.collectionId, payload)
            : this.client.objects.search(payload);
            
        return request;
    }

    _facetsRequest() {
        const payload: ComputeObjectFacetPayload = { facets: this.facetSpecs, query: this.query }
        return this.collectionId ?
            this.client.collections.computeFacets(this.collectionId, payload)
            : this.client.objects.computeFacets(payload);
    }

    computeFacets(_query: ObjectSearchQuery) {
        this._facetsRequest().then((facets) => {
            this.facets.value = facets;
        });
    }

    _search(loadMore = false, noFacets = false) {
        if (this.isRunning && loadMore) { // avoid searching when a search is pending, but allow initial search
            return Promise.resolve(false);
        }
        this.result.value = {
            isLoading: true,
            objects: loadMore ? this.objects : [],
            hasMore: loadMore ? this.result.value.hasMore : true
        }
        const limit = this.limit;
        const offset = loadMore ? this.objects.length : 0;
        return this._searchRequest(this.query, limit, offset, !noFacets).then(async (res) => {
            // Handle the new format with results and facets
            const results = res.results || [];
            const facets = res.facets || {};

            this.result.value = {
                isLoading: false,
                objects: loadMore ? this.objects.concat(results) : results,
                hasMore: results.length === limit
            }

            // Update facets if they were requested and returned
            if (!noFacets && facets && Object.keys(facets).length > 0) {
                this.facets.value = facets;
            }

            return true;
        }).catch((err) => {
            this.result.value = {
                error: err,
                isLoading: false,
                objects: this.objects,
                hasMore: this.result.value.hasMore
            }
            throw err;
        })
    }

    search(noFacets = false) {
        // Allow initial search even if isLoading is true (for initial page load)
        if (this.isRunning && this.objects.length > 0) {
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
