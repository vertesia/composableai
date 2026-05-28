import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { SortableTableHeaderCell, type SortDirection } from '@vertesia/ui/core';

export type SortDir = 'asc' | 'desc';

interface SortableHeadProps<TField extends string> {
    field: TField;
    label: string;
    activeField: TField;
    direction: SortDir;
    onSort: (field: TField) => void;
    className?: string;
}

const directionToAria: Record<SortDir, SortDirection> = {
    asc: 'ascending',
    desc: 'descending',
};

export function SortableHead<TField extends string>({
    field,
    label,
    activeField,
    direction,
    onSort,
    className,
}: SortableHeadProps<TField>) {
    const isActive = activeField === field;
    const Icon = isActive ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
        <SortableTableHeaderCell
            sortDirection={isActive ? directionToAria[direction] : 'none'}
            onSort={() => onSort(field)}
            className={`text-start select-none${className ? ` ${className}` : ''}`}
            sortIndicator={() => <Icon className={`size-3 ${isActive ? '' : 'opacity-40'}`} aria-hidden="true" />}
        >
            {label}
        </SortableTableHeaderCell>
    );
}
