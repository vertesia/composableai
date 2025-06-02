import { ContentObjectTypeItem, ObjectTypeSearchQuery } from "@vertesia/common";
import { VertesiaClient, ZenoClient } from "@vertesia/client";
import { SharedState, useWatchSharedState } from "@vertesia/ui/core";
import { createContext, useContext } from "react";


interface ObjectTypeSearchResult {
    objects: ContentObjectTypeItem[],
    error?: Error;
    isLoading: boolean;
}

export class ObjectTypeSearch {
    result = new SharedState<ObjectTypeSearchResult>({ objects: [], isLoading: false });

    query: ObjectTypeSearchQuery = {};

    constructor(public client: VertesiaClient | ZenoClient, public limit = 100) { }

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
        this.search();
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

    async _search(loadMore = false) {
        if (this.isRunning) {
            return Promise.resolve(false);
        }
        this.result.value = {
            isLoading: true,
            objects: loadMore ? this.objects : [],
        }
        const limit = this.limit;
        const offset = this.objects.length;
        return this.client.types.list({
            limit,
            offset,
            query: this.query
        }).then(async (result) => {
            this.result.value = {
                isLoading: false,
                objects: this.objects.concat(result)
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

    search() {
        if (this.isRunning) {
            return Promise.resolve(false);
        }
        return this._search(false);
    }

    loadMore() {
        if (this.isRunning) {
            return Promise.resolve(false);
        }
        return this._search(true);
    }
}

const ObjectTypeSearchContext = createContext<ObjectTypeSearch | undefined>(undefined);

export function useSearch() {
    return useContext(ObjectTypeSearchContext)!;
}

export function useWatchSearchResult() {
    const search = useSearch();
    const result = useWatchSharedState(search.result);
    return { ...result, search };
}

export function useSearchCount() {
    const search = useSearch();
    return search.objects.length;
}

export { ObjectTypeSearchContext };
