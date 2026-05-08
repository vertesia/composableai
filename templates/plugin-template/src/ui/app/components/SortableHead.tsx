import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

export type SortDir = 'asc' | 'desc';

interface SortableHeadProps<TField extends string> {
    field: TField;
    label: string;
    activeField: TField;
    direction: SortDir;
    onSort: (field: TField) => void;
}

export function SortableHead<TField extends string>({
    field,
    label,
    activeField,
    direction,
    onSort,
}: SortableHeadProps<TField>) {
    const isActive = activeField === field;
    const Icon = isActive ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
        <th
            scope="col"
            aria-sort={
                isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
            }
            className="text-left cursor-pointer select-none"
            onClick={() => onSort(field)}
        >
            <div className="flex items-center gap-1">
                <span>{label}</span>
                <Icon
                    className={`size-3 ${isActive ? '' : 'opacity-40'}`}
                    aria-hidden="true"
                />
            </div>
        </th>
    );
}
