import { useIntersectionObserver } from "@vertesia/ui/core";
import { useEffect, useRef, useState } from "react";

interface SearchResponse<ResultT, PageT> {
    /**
     * The search result
     */
    result: ResultT[];

    /**
     * The next page information or null if no more pages are available
     */
    nextPage: PageT | null;
}

/**
 * The search function signature.
 * @param payload The search payload
 * @param page The information for the page to fetch. Use null to fetch the first page
 * @param pageSize The number of items per page
 * @returns A promise that resolves to the search response
 */
type SearchFn<PayloadT, ResultT, PageT = number> = (payload: PayloadT, page: PageT | null, pageSize: number) => Promise<SearchResponse<ResultT, PageT>>;


interface ScrollableSearchOptions<ResultT, PayloadT, PageT = number> {
    /**
     * the search function
     */
    search: SearchFn<PayloadT, ResultT, PageT>;

    /**
     * Initial paylload for the first search
     */
    payload: PayloadT;

    /**
     * Which page size to use. Defaults to 50.
     */
    pageSize?: number;

    /**
     * A ref to the element that triggers loading the next page when it enters the viewport
     */
    nextPageTrigger: React.RefObject<HTMLElement | null>;
}

interface ScrollableSearchResult<ResultT, PayloadT, PageT = number> {
    /**
     * Initiates a new search with the given payload
     * @param payload The search payload
     */
    search: (payload: PayloadT) => void;

    /**
     * Refreshes the current search with the last used payload
     */
    refresh: () => void;

    /**
     * Loads the next page of results
     */
    searchMore: () => void;

    /**
     * The current accumulated search result
     */
    result: ResultT[];

    /**
     * The current page information
     */
    page: PageT | null;

    /**
     * Whether there are more pages to load
     */
    hasMore: boolean;

    /**
     * Any error that occurred during the last search
     */
    error: Error | null;

    /**
     * Whether a search is currently in progress
     */
    isSearching: boolean;
}

/**
 * A hook that provides paginated search functionality with infinite scrolling support.
 */
export function useScrollableSearch<ResultT, PayloadT, PageT = number>(opts: ScrollableSearchOptions<ResultT, PayloadT, PageT>, dependencies: any[] = []): ScrollableSearchResult<ResultT, PayloadT, PageT> {
    const pageSize = opts.pageSize || 50;
    const [page, setPage] = useState<PageT | null>(null);
    const [lastPayload, setLastPayload] = useState<PayloadT>(opts.payload);
    const [error, setError] = useState<Error | null>(null);
    const [results, setResults] = useState<ResultT[]>([]);
    const [nextPage, setNextPage] = useState<PageT | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    // Track current request to prevent stale results
    const requestIdRef = useRef(0);

    const search = (payload: PayloadT) => {
        setPage(null);
        setResults([]);  // Clear old results immediately
        setNextPage(null);
        setLastPayload(payload);
    }

    const searchMore = () => {
        if (nextPage !== null) {
            setPage(nextPage);
        }
    }

    useEffect(() => {
        // Increment request ID to mark previous requests as stale
        requestIdRef.current += 1;
        const currentRequestId = requestIdRef.current;

        setIsSearching(true);
        opts.search(lastPayload, page, pageSize).then(r => {
            // Only update state if this is still the current request
            if (currentRequestId !== requestIdRef.current) {
                return; // Stale request, ignore results
            }

            // If page is null, it's a new search - replace results
            // Otherwise, it's loading more - append results
            if (page === null) {
                setResults(r.result);
            } else {
                setResults(prev => [...prev, ...r.result]);
            }
            setNextPage(r.nextPage);
            setError(null);
        }).catch(error => {
            // Only update error if this is still the current request
            if (currentRequestId !== requestIdRef.current) {
                return; // Stale request, ignore error
            }
            setError(error);
        }).finally(() => {
            // Only update isSearching if this is still the current request
            if (currentRequestId === requestIdRef.current) {
                setIsSearching(false);
            }
        });
    }, [...dependencies, lastPayload, page]);

    // Intersection observer for infinite scrolling
    useIntersectionObserver(opts.nextPageTrigger, () => {
        if (!isSearching && nextPage) {
            searchMore();
        }
    }, { threshold: 0.1, deps: [nextPage, isSearching] });

    return {
        search,
        refresh: () => search(lastPayload),
        searchMore,
        result: results,
        page,
        hasMore: nextPage !== null,
        error,
        isSearching,
    }
}

type DefaultSearchFn<PayloadT, ResultT> = (payload: PayloadT, offset: number, limit: number) => Promise<ResultT[]>;

interface DefaultScrollableSearchOptions<ResultT, PayloadT> extends Omit<ScrollableSearchOptions<ResultT, PayloadT, number>, 'search'> {
    search: DefaultSearchFn<PayloadT, ResultT>;
}

export function useDefaultScrollableSearch<ResultT, PayloadT>(opts: DefaultScrollableSearchOptions<ResultT, PayloadT>, dependencies: any[] = []): ScrollableSearchResult<ResultT, PayloadT, number> {
    const actualOpts: ScrollableSearchOptions<ResultT, PayloadT, number> = {
        ...opts,
        async search(payload, page, pageSize) {
            const currentPage = page ?? 0;
            const offset = currentPage * pageSize;
            const result = await opts.search(payload, offset, pageSize);
            return {
                result,
                nextPage: result.length === 0 ? null : currentPage + 1
            };
        }
    };
    return useScrollableSearch<ResultT, PayloadT, number>(actualOpts, dependencies);
}