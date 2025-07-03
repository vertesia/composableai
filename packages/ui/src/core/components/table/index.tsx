import clsx from "clsx";
import React from "react";


const defaultTableCass = `
divide-y divide-border
[&>tbody]:divide-y [&>tbody]:divide-border
[&_th]:text-left [&_th]:px-3 [&_th]:py-3.5 [&_th]:text-sm [&_th]:font-normal [&_th]:text-muted-foreground
[&_td]:px-3 [&_td]:py-4 [&_td]:text-sm
`;


export function Table({ className, children, ...others }: React.HTMLProps<HTMLTableElement>) {
    return (
        <table className={clsx(defaultTableCass, className)} {...others}>
            {children}
        </table>
    )
}

export function RowSkeleton({ columns }: { columns: number }) {
    return (
        <tr className="hover:bg-muted">
            {Array(columns).fill(0).map((_, index) =>
                <td key={index}>
                    <div className="animate-pulse rounded-xs h-5 bg-gray-200 dark:bg-gray-600"></div>
                </td>
            )}
        </tr>
    )
}

interface TBodySkeletonProps {
    isLoading?: boolean
    columns: number
    rows?: number
    children: React.ReactNode
}

export function TBody({ isLoading = false, columns, rows = 3, children }: TBodySkeletonProps) {
    return (
        <tbody>
            {isLoading ?
                Array(rows).fill(0).map((_, index) => <RowSkeleton columns={columns} key={index} />)
                : children
            }
        </tbody>
    )
}

export function TR({ className, children, ...others }: React.HTMLProps<HTMLTableRowElement>) {
    return (
        <tr className={clsx("hover:bg-muted hover:cursor-pointer", className)} {...others}>
            {children}
        </tr>
    )
}
