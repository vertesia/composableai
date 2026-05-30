import type { AgentRunStatus } from '@vertesia/common';
import type { Filter } from '@vertesia/ui/core';
import type { BadgeVariant } from './types';

export function statusVariant(status?: AgentRunStatus): BadgeVariant {
    switch (status) {
        case 'completed':
            return 'success';
        case 'failed':
        case 'cancelled':
            return 'destructive';
        case 'running':
            return 'attention';
        default:
            return 'default';
    }
}

export function getSelectValues(filters: Filter[], name: string): string[] {
    const filter = filters.find((f) => f.name === name);
    if (!filter || !Array.isArray(filter.value) || filter.value.length === 0) return [];
    return filter.value
        .map((v) => (typeof v === 'string' ? v : (v.value ?? '')))
        .filter((v): v is string => Boolean(v));
}
