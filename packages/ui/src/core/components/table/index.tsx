import clsx from 'clsx';
import type React from 'react';

const defaultTableCass = `
divide-y divide-border
[&>tbody]:divide-y [&>tbody]:divide-border
[&_th]:text-start [&_th]:px-3 [&_th]:py-3.5 [&_th]:text-sm [&_th]:font-normal [&_th]:text-muted-foreground
[&_td]:px-3 [&_td]:py-4 [&_td]:text-sm
`;

export function Table({ className, children, ...others }: React.HTMLProps<HTMLTableElement>) {
    return (
        <table className={clsx(defaultTableCass, className)} {...others}>
            {children}
        </table>
    );
}

interface THeadProps {
    children: React.ReactNode;
}
export function THead({ children }: Readonly<THeadProps>) {
    return (
        <thead className="sticky top-0 bg-background z-10 after:absolute after:bottom-0 after:start-0 after:w-full after:h-px after:bg-muted/20">
            {children}
        </thead>
    );
}

export function RowSkeleton({ columns }: { columns: number }) {
    return (
        <tr className="hover:bg-muted">
            {Array(columns)
                .fill(0)
                .map((_, index) => (
                    <td key={`skeleton-cell-${index}`}>
                        <div className="animate-pulse rounded-xs h-5 bg-muted"></div>
                    </td>
                ))}
        </tr>
    );
}

interface TBodySkeletonProps {
    isLoading?: boolean;
    columns: number;
    rows?: number;
    children: React.ReactNode;
}
export function TBody({ isLoading = false, columns, rows = 3, children }: Readonly<TBodySkeletonProps>) {
    const skeletonRows = Array.from({ length: rows }, (_, index) => `skeleton-row-${index}`);

    return (
        <tbody>{isLoading ? skeletonRows.map((key) => <RowSkeleton columns={columns} key={key} />) : children}</tbody>
    );
}

export function TR({ className, children, ...others }: React.HTMLProps<HTMLTableRowElement>) {
    return (
        <tr className={clsx('hover:bg-muted hover:cursor-pointer', className)} {...others}>
            {children}
        </tr>
    );
}

/**
 * Header cell. Defaults to scope="col" so screen readers associate column
 * cells with their header. Pass scope="row" for row headers.
 */
export function TableHeaderCell({ scope = 'col', children, ...others }: React.ThHTMLAttributes<HTMLTableCellElement>) {
    return (
        <th scope={scope} {...others}>
            {children}
        </th>
    );
}

export type SortDirection = 'ascending' | 'descending' | 'none';

interface SortableTableHeaderCellProps
    extends Omit<React.ThHTMLAttributes<HTMLTableCellElement>, 'onClick' | 'aria-sort'> {
    /** Current sort state. Drives aria-sort on the <th>. */
    sortDirection?: SortDirection;
    /** Fired when the user activates the sort trigger (mouse or keyboard). */
    onSort?: () => void;
    /** Visual sort indicator rendered after the children. Receives the current direction. */
    sortIndicator?: (direction: SortDirection) => React.ReactNode;
    /** Disable the sort trigger; renders children without a button wrapper. */
    disabled?: boolean;
    children: React.ReactNode;
}

/**
 * Sortable header cell. Renders the trigger as a real <button> inside the
 * <th> and exposes the current sort direction via aria-sort on the <th>
 * (the WAI-ARIA-recommended pattern). The button is keyboard-operable
 * automatically — no onKeyDown plumbing required.
 */
export function SortableTableHeaderCell({
    sortDirection = 'none',
    onSort,
    sortIndicator,
    disabled = false,
    children,
    className,
    scope = 'col',
    ...others
}: SortableTableHeaderCellProps) {
    return (
        <th scope={scope} aria-sort={sortDirection} className={className} {...others}>
            {disabled ? (
                <span className="inline-flex items-center gap-1">
                    {children}
                    {sortIndicator?.(sortDirection)}
                </span>
            ) : (
                <button
                    type="button"
                    onClick={onSort}
                    className="inline-flex items-center gap-1 bg-transparent border-0 p-0 m-0 text-inherit font-inherit cursor-pointer hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                >
                    {children}
                    {sortIndicator?.(sortDirection)}
                </button>
            )}
        </th>
    );
}
