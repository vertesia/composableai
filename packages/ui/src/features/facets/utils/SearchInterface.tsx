import type { Filter as BaseFilter } from '@vertesia/ui/core';

interface defaultKeys {
    [key: string]: string;
}
export interface SearchInterface<Query extends object = object> {
    getFilterValue(name: string): unknown;
    setFilterValue(name: string, value: unknown): void;
    clearFilters(autoSearch?: boolean, applyDefaults?: boolean): void;
    search(applyDefaults?: boolean): Promise<boolean | undefined>;
    setDefaultKeys(keys: defaultKeys[]): void;
    readonly isRunning: boolean;
    readonly initialized?: boolean;
    readonly totalCount?: number;
    query: Query;
}

interface FilterOptionValue {
    value?: unknown;
}

function isFilterOptionValue(value: unknown): value is FilterOptionValue {
    return typeof value === 'object' && value !== null && 'value' in value;
}

export function unwrapFilterOptionValue(value: unknown): unknown {
    return isFilterOptionValue(value) ? value.value : value;
}

export function filterValueToQueryValue(filter: BaseFilter): unknown {
    if (filter.type === 'stringList') {
        return filter.value.map((value) => (typeof value === 'string' ? value : unwrapFilterOptionValue(value)));
    }
    if (filter.multiple) {
        return filter.value.map(unwrapFilterOptionValue);
    }
    const firstValue = filter.value[0];
    return firstValue === undefined ? undefined : unwrapFilterOptionValue(firstValue);
}

export function setSearchQueryValue<Query extends object, Name extends Extract<keyof Query, string>>(
    search: SearchInterface<Query>,
    name: Name,
    value: unknown,
): void {
    (search.query as Record<string, unknown>)[name] = value;
}

export function createSearchQueryKeyGuard<Query extends object>(names: readonly (keyof Query)[]) {
    const nameSet = new Set<PropertyKey>(names);
    return (name: string): name is Extract<keyof Query, string> => nameSet.has(name);
}
