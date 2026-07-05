import { Button, CopyButton, VTooltip } from '@vertesia/ui/core';
import { Filter } from 'lucide-react';
import { createContext, type ReactNode, useContext } from 'react';

export type DocumentQuickFilter = (field: string, value: string | string[]) => void;

const DocumentQuickFilterContext = createContext<DocumentQuickFilter | undefined>(undefined);

/**
 * Provides a quick-filter handler to the document table cells below it (read via
 * {@link useDocumentQuickFilter}). Only surfaces that own a filter bar — e.g. DocumentSearchResults —
 * need to supply one; everywhere else the per-cell filter buttons stay inert.
 */
export function DocumentQuickFilterProvider({
    onFilter,
    children,
}: {
    onFilter?: DocumentQuickFilter;
    children: ReactNode;
}) {
    return <DocumentQuickFilterContext.Provider value={onFilter}>{children}</DocumentQuickFilterContext.Provider>;
}

export function useDocumentQuickFilter() {
    return useContext(DocumentQuickFilterContext);
}

const ACTION_BTN_CLASS =
    'h-6 w-6 p-0 opacity-0 group-hover/field:opacity-100 text-muted hover:text-foreground transition-opacity shrink-0';

/**
 * Hover-revealed per-cell actions for the document table: an optional copy button (for id-valued
 * fields) and a "Filter by ..." button wired to the {@link DocumentQuickFilterProvider} handler.
 */
export function DocumentCellActions({
    field,
    value,
    label,
    copyContent,
}: {
    field: string;
    value?: string | string[];
    label: string;
    copyContent?: string;
}) {
    const onFilter = useDocumentQuickFilter();
    const hasValue = Array.isArray(value) ? value.length > 0 : value !== undefined && value !== '';

    return (
        <>
            {copyContent !== undefined && copyContent !== '' && (
                <CopyButton content={copyContent} className={ACTION_BTN_CLASS} />
            )}
            {hasValue && value !== undefined && (
                <VTooltip description={`Filter by ${label}`} asChild size="xs">
                    <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Filter by ${label}`}
                        className={ACTION_BTN_CLASS}
                        onClick={(e) => {
                            e.stopPropagation();
                            onFilter?.(field, value);
                        }}
                    >
                        <Filter className="size-3" />
                    </Button>
                </VTooltip>
            )}
        </>
    );
}
