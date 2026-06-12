import { ContentObjectStatus } from '@vertesia/common';
import type { Filter } from '@vertesia/ui/core';
import type { BadgeVariant } from './types';

export function statusVariant(status?: ContentObjectStatus): BadgeVariant {
    switch (status) {
        case ContentObjectStatus.ready:
        case ContentObjectStatus.completed:
            return 'success';
        case ContentObjectStatus.failed:
            return 'destructive';
        case ContentObjectStatus.processing:
        case ContentObjectStatus.created:
            return 'attention';
        case ContentObjectStatus.archived:
            return 'done';
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
