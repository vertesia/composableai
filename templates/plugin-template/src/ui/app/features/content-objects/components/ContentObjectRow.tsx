import { memo, useMemo } from 'react';
import { Badge } from '@vertesia/ui/core';
import type { ContentObjectItem } from '@vertesia/common';
import { InlineFilterButton } from '../../../components/InlineFilterButton';
import type { FilterableField } from '../types';
import { statusVariant } from '../utils';

interface ContentObjectRowProps {
    item: ContentObjectItem;
    t: (key: string, opts?: Record<string, unknown>) => string;
    onAddFilter: (name: FilterableField, value: string, label: string) => void;
    onOpen: (id: string) => void;
}

function ContentObjectRowImpl({ item, t, onAddFilter, onOpen }: ContentObjectRowProps) {
    const updated = useMemo(
        () => (item.updated_at ? new Date(item.updated_at).toLocaleString() : '—'),
        [item.updated_at],
    );
    const typeName = item.type?.name;
    const typeId = item.type && 'id' in item.type ? item.type.id : undefined;
    const statusLabel = item.status ? t(`objects.status.${item.status}`) : '—';

    return (
        <tr
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => onOpen(item.id)}
        >
            <td>
                <div className="flex flex-col">
                    <span className="font-medium">{item.name || item.id}</span>
                    {item.description && (
                        <span className="text-xs text-muted-foreground line-clamp-1">
                            {item.description}
                        </span>
                    )}
                </div>
            </td>
            <td className="group/type">
                <div className="flex items-center justify-between gap-2">
                    <span>{typeName ?? '—'}</span>
                    {typeId && typeName && (
                        <InlineFilterButton
                            tooltip={t('objects.filterByValue', { value: typeName })}
                            hoverClass="group-hover/type:opacity-100"
                            onClick={() => onAddFilter('type', typeId, typeName)}
                        />
                    )}
                </div>
            </td>
            <td className="group/status">
                <div className="flex items-center justify-between gap-2">
                    <Badge variant={statusVariant(item.status)}>{statusLabel}</Badge>
                    {item.status && (
                        <InlineFilterButton
                            tooltip={t('objects.filterByValue', { value: statusLabel })}
                            hoverClass="group-hover/status:opacity-100"
                            onClick={() => onAddFilter('status', item.status, statusLabel)}
                        />
                    )}
                </div>
            </td>
            <td className="text-sm text-muted-foreground">{updated}</td>
        </tr>
    );
}

export const ContentObjectRow = memo(ContentObjectRowImpl);
