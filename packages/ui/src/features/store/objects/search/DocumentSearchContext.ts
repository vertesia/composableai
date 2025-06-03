import { createContext, useContext } from 'react';

import { SharedState, useWatchSharedState } from '@vertesia/ui/core';
import { ComputeFacetsResponse, ZenoClient } from '@vertesia/client';
import { ComplexSearchQuery, ContentObjectItem, FacetBucket, FacetSpec, ObjectSearchQuery } from '@vertesia/common';

interface DocumentSearchResult {
    objects: ContentObjectItem[],
    error?: Error;
    isLoading: boolean;
}


export class DocumentSearch {

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

    get isRunning() {
        return this.result.value.isLoading;
    }

    getFilterValue(name: string) {
        return (this.query as any)[name];
    }

    setFilterValue(name: string, value: any) {
        (this.query as any)[name] = value;
        // search now
        this.search();
    }

    clearFilters() {
        const parent = this.query.parent;
        this.query = {
            parent
        };

        this.search();
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
            isLoading
        };
    }

    _updateRunningState(value: boolean) {
        const prev = this.result.value;
        this.result.value = {
            objects: prev.objects,
            isLoading: value,
            error: prev.error
        }
    }

    _searchRequest(query: ComplexSearchQuery, limit: number, offset: number) {
        return this.collectionId ?
            this.client.collections.searchMembers(this.collectionId, {
                limit,
                offset,
                query
            })
            : this.client.objects.search({
                limit,
                offset,
                query
            });
    }

    _facetsRequest() {
        return this.collectionId ?
            this.client.collections.computeFacets(this.collectionId, {
                facets: this.facetSpecs,
                query: this.query
            })
            : this.client.objects.computeFacets({
                facets: this.facetSpecs,
                query: this.query
            });
    }

    computeFacets(_query: ObjectSearchQuery) {
        this._facetsRequest().then((facets) => {
            this.facets.value = facets;
        });
    }

    _search(loadMore = false) {
        if (this.isRunning) { // avoid searching when a search is pending
            return Promise.resolve(false);
        }
        this.result.value = {
            isLoading: true,
            objects: loadMore ? this.objects : [],
        }
        const limit = this.limit;
        const offset = this.objects.length;
        return this._searchRequest(this.query, limit, offset).then(async (res) => {
            this.result.value = {
                isLoading: false,
                objects: this.objects.concat(res)
            }
            return true;
        }).catch((err) => {
            this.result.value = {
                error: err,
                isLoading: false,
                objects: this.objects
            }
            throw err;
        })
    }

    search(noFacets = false) {
        if (this.isRunning) return Promise.resolve(false);
        !noFacets && this.computeFacets(this.query);
        return this._search(false);
    }

    loadMore(noFacets = false) {
        if (this.isRunning) return Promise.resolve(false);
        if (this.objects.length === 0) {
            !noFacets && this.computeFacets(this.query);
        }
        return this._search(true);
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
