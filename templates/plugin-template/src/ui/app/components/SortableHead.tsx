import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

export type SortDir = 'asc' | 'desc';
type AriaSortDirection = 'ascending' | 'descending' | 'none';

interface SortableHeadProps<TField extends string> {
    field: TField;
    label: string;
    activeField: TField;
    direction: SortDir;
    onSort: (field: TField) => void;
    className?: string;
}

const directionToAria: Record<SortDir, AriaSortDirection> = {
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
    const ariaSort = isActive ? directionToAria[direction] : 'none';

    return (
        <th aria-sort={ariaSort} className={`text-start select-none${className ? ` ${className}` : ''}`}>
            <button type="button" className="flex w-full items-center gap-1 text-start" onClick={() => onSort(field)}>
                <span>{label}</span>
                <Icon className={`size-3 ${isActive ? '' : 'opacity-40'}`} aria-hidden="true" />
            </button>
        </th>
    );
}
