import type { ExecuteViewRequest, ViewExecutionResult } from '@vertesia/common';

const QUERY_PARAM = 'q';
const DISPLAY_PARAM = 'display';
const SORT_PARAM = 'sort';
const OFFSET_PARAM = 'offset';
const KEY_TERM_PREFIX = 't.';
const NAVIGATION_PREFIX = 'n.';
const NAVIGATION_QUERY_PREFIX = 'nq.';

function nonNegativeInteger(value: string | null): number | undefined {
    if (value === null || value.trim() === '') return undefined;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function collectPrefixedValues(params: URLSearchParams, prefix: string): Record<string, string[]> | undefined {
    const values: Record<string, string[]> = {};
    for (const key of new Set(params.keys())) {
        if (!key.startsWith(prefix) || key.length === prefix.length) continue;
        const entries = params.getAll(key).filter((value) => value !== '');
        if (entries.length > 0) values[key.slice(prefix.length)] = entries;
    }
    return Object.keys(values).length > 0 ? values : undefined;
}

function collectPrefixedStrings(params: URLSearchParams, prefix: string): Record<string, string> | undefined {
    const values: Record<string, string> = {};
    for (const key of new Set(params.keys())) {
        if (!key.startsWith(prefix) || key.length === prefix.length) continue;
        const value = params.get(key)?.trim();
        if (value) values[key.slice(prefix.length)] = value;
    }
    return Object.keys(values).length > 0 ? values : undefined;
}

/** Parse the stable, shareable URL representation of a View execution request. */
export function parseViewState(search: string): ExecuteViewRequest {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const query = params.get(QUERY_PARAM)?.trim();
    const display = params.get(DISPLAY_PARAM)?.trim();
    const sort = params.get(SORT_PARAM)?.trim();
    const offset = nonNegativeInteger(params.get(OFFSET_PARAM));
    const key_terms = collectPrefixedValues(params, KEY_TERM_PREFIX);
    const navigation = collectPrefixedValues(params, NAVIGATION_PREFIX);
    const navigation_queries = collectPrefixedStrings(params, NAVIGATION_QUERY_PREFIX);

    return {
        ...(query ? { query } : {}),
        ...(key_terms ? { key_terms } : {}),
        ...(navigation ? { navigation } : {}),
        ...(navigation_queries ? { navigation_queries } : {}),
        ...(display ? { display } : {}),
        ...(sort ? { sort } : {}),
        ...(offset ? { offset } : {}),
    };
}

function deleteManagedParams(params: URLSearchParams): void {
    for (const key of [...params.keys()]) {
        if (
            key === QUERY_PARAM ||
            key === DISPLAY_PARAM ||
            key === SORT_PARAM ||
            key === OFFSET_PARAM ||
            key.startsWith(KEY_TERM_PREFIX) ||
            key.startsWith(NAVIGATION_QUERY_PREFIX) ||
            key.startsWith(NAVIGATION_PREFIX)
        ) {
            params.delete(key);
        }
    }
}

function appendRecord(params: URLSearchParams, prefix: string, values: Record<string, string[]> | undefined): void {
    if (!values) return;
    for (const [key, entries] of Object.entries(values).sort(([left], [right]) => left.localeCompare(right))) {
        for (const value of entries) {
            if (value !== '') params.append(`${prefix}${key}`, value);
        }
    }
}

function appendStringRecord(params: URLSearchParams, prefix: string, values: Record<string, string> | undefined): void {
    if (!values) return;
    for (const [key, value] of Object.entries(values).sort(([left], [right]) => left.localeCompare(right))) {
        if (value.trim()) params.set(`${prefix}${key}`, value.trim());
    }
}

/** Serialize View state while preserving unrelated host parameters such as account/project selection. */
export function serializeViewState(request: ExecuteViewRequest, currentSearch = ''): string {
    const params = new URLSearchParams(currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch);
    deleteManagedParams(params);

    if (request.query?.trim()) params.set(QUERY_PARAM, request.query.trim());
    if (request.display) params.set(DISPLAY_PARAM, request.display);
    if (request.sort) params.set(SORT_PARAM, request.sort);
    if (request.offset && request.offset > 0) params.set(OFFSET_PARAM, String(request.offset));
    appendRecord(params, KEY_TERM_PREFIX, request.key_terms);
    appendRecord(params, NAVIGATION_PREFIX, request.navigation);
    appendStringRecord(params, NAVIGATION_QUERY_PREFIX, request.navigation_queries);

    const value = params.toString();
    return value ? `?${value}` : '';
}

function selectedRecord(result: ViewExecutionResult): Record<string, string[]> | undefined {
    const selections = Object.fromEntries(
        Object.entries(result.navigation)
            .filter(([, navigation]) => navigation.selected.length > 0)
            .map(([id, navigation]) => [id, navigation.selected]),
    );
    return Object.keys(selections).length > 0 ? selections : undefined;
}

function navigationQueryRecord(result: ViewExecutionResult): Record<string, string> | undefined {
    const queries: Record<string, string> = {};
    for (const [id, navigation] of Object.entries(result.navigation)) {
        if (navigation.query) queries[id] = navigation.query;
    }
    return Object.keys(queries).length > 0 ? queries : undefined;
}

/** Remove stale configuration IDs and apply the display/sort selected by the authoritative runtime. */
export function canonicalizeViewState(request: ExecuteViewRequest, result: ViewExecutionResult): ExecuteViewRequest {
    const keyTermIds = new Set(result.definition.search?.key_terms?.map((term) => term.id) ?? []);
    const key_terms = request.key_terms
        ? Object.fromEntries(
              Object.entries(request.key_terms).filter(([id, values]) => keyTermIds.has(id) && values.length),
          )
        : undefined;
    const navigation = selectedRecord(result);
    const navigation_queries = navigationQueryRecord(result);

    return {
        ...(request.query?.trim() ? { query: request.query.trim() } : {}),
        ...(key_terms && Object.keys(key_terms).length > 0 ? { key_terms } : {}),
        ...(navigation ? { navigation } : {}),
        ...(navigation_queries ? { navigation_queries } : {}),
        ...(result.display ? { display: result.display } : {}),
        ...(result.sort ? { sort: result.sort } : {}),
        ...(request.offset && request.offset > 0 ? { offset: request.offset } : {}),
        ...(request.limit ? { limit: request.limit } : {}),
    };
}

/**
 * Resolve the sort the server actually applied. Natural-language queries with
 * no returned sort use Elasticsearch relevance rather than the browse default.
 */
export function resolveViewSort(
    request: ExecuteViewRequest,
    result: ViewExecutionResult,
    defaultSort: string | undefined,
): string | undefined {
    return result.sort ?? request.sort ?? (request.query?.trim() ? undefined : defaultSort);
}

export function replaceViewStateInUrl(request: ExecuteViewRequest): void {
    if (typeof window === 'undefined') return;
    const search = serializeViewState(request, window.location.search);
    window.history.replaceState(window.history.state || {}, '', `${window.location.pathname}${search}`);
}
