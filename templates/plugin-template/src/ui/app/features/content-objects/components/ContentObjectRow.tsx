import { memo } from 'react';
import { Badge } from '@vertesia/ui/core';
import { InlineFilterButton } from '../../../components/InlineFilterButton';
import type { FilterableField } from '../types';
import type { ContentObjectRowModel } from '../types';

interface ContentObjectRowProps {
    row: ContentObjectRowModel;
    onAddFilter: (name: FilterableField, value: string, label: string) => void;
    onOpen: (id: string) => void;
}

function ContentObjectRowImpl({ row, onAddFilter, onOpen }: ContentObjectRowProps) {
    return (
        <tr
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => onOpen(row.id)}
        >
            <td>
                <div className="flex flex-col">
                    <span className="font-medium">{row.title}</span>
                    {row.description && (
                        <span className="text-xs text-muted-foreground line-clamp-1">
                            {row.description}
                        </span>
                    )}
                </div>
            </td>
            <td className="group/type">
                <div className="flex items-center justify-between gap-2">
                    <span>{row.typeName}</span>
                    {row.typeId && row.typeFilterTooltip && (
                        <InlineFilterButton
                            tooltip={row.typeFilterTooltip}
                            hoverClass="group-hover/type:opacity-100"
                            onClick={() => onAddFilter('type', row.typeId!, row.typeName)}
                        />
                    )}
                </div>
            </td>
            <td className="group/status">
                <div className="flex items-center justify-between gap-2">
                    <Badge variant={row.statusVariant}>{row.statusLabel}</Badge>
                    {row.statusValue && row.statusFilterTooltip && (
                        <InlineFilterButton
                            tooltip={row.statusFilterTooltip}
                            hoverClass="group-hover/status:opacity-100"
                            onClick={() => onAddFilter('status', row.statusValue!, row.statusLabel)}
                        />
                    )}
                </div>
            </td>
            <td className="text-sm text-muted-foreground">{row.updatedLabel}</td>
        </tr>
    );
}

export const ContentObjectRow = memo(ContentObjectRowImpl);
