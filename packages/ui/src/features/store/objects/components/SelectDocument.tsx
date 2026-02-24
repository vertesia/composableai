import { useCallback, useEffect, useRef, useState } from "react";

import { clsx } from "clsx";
import { RefreshCw } from "lucide-react";

import { DocumentsFacetsNav } from "../../../facets";
import { DocumentTable } from "../DocumentTable";
import { useDocumentSearch, useWatchDocumentSearchFacets, useWatchDocumentSearchResult } from "../search/DocumentSearchContext";
import { DocumentSearchProvider } from "../search/DocumentSearchProvider";
import { ContentDispositionButton } from "./ContentDispositionButton";

import { ColumnLayout, ContentObjectItem } from "@vertesia/common";
import { Button, ErrorBox, Spinner, useIntersectionObserver } from "@vertesia/ui/core";

const layout: ColumnLayout[] = [
    { "name": "Name", "field": "properties.title", "type": "string", "fallback": "name" },
    { "name": "Type", "field": "type.name", "type": "string" },
    { "name": "Status", "field": "status", "type": "string" },
    { "name": "Created At", "field": "created_at", "type": "date" }
];

const LAST_DISPLAYED_VIEW = "vertesia.content_store.lastDisplayedView"

interface SelectDocumentProps {
    onChange: (value: ContentObjectItem) => void;
    type?: string;
    mimeType?: string;
    /** IDs of already-selected documents — used to highlight rows */
    selectedIds?: Set<string>;
}
export function SelectDocument({ onChange, selectedIds }: Readonly<SelectDocumentProps>) {
    const onRowClick = (selected: ContentObjectItem) => {
        onChange(selected || undefined);
    }

    return (
        <DocumentSearchProvider>
            <SelectDocumentImpl onRowClick={onRowClick} selectedIds={selectedIds} />
        </DocumentSearchProvider>
    )
}

interface SelectDocumentImplProps {
    onRowClick: (selected: ContentObjectItem) => void;
    selectedIds?: Set<string>;
}
function SelectDocumentImpl({ onRowClick, selectedIds }: Readonly<SelectDocumentImplProps>) {
    const highlightRow = useCallback(
        (item: ContentObjectItem) => !!selectedIds?.has(item.id),
        [selectedIds],
    );
    const [isReady, setIsReady] = useState(false);
    const [isGridView, setIsGridView] = useState(localStorage.getItem(LAST_DISPLAYED_VIEW) === "grid");
    const { search, isLoading, error, objects, hasMore } = useWatchDocumentSearchResult();

    const loadMoreRef = useRef<HTMLDivElement>(null);
    useIntersectionObserver(loadMoreRef, () => {
        if (isReady && hasMore && !isLoading) {
            setIsReady(false);
            search.loadMore(true)
                .finally(() => {
                    setIsReady(true);
                });
        }
    }, { threshold: 0.1, deps: [isReady, hasMore, isLoading] });

    useEffect(() => {
        search.search()
            .finally(() => {
                setIsReady(true);
            });
    }, []);

    const facets = useWatchDocumentSearchFacets();
    const facetSearch = useDocumentSearch();

    const handleRefetch = () => {
        setIsReady(false);
        search.search().then(() => setIsReady(true));
    }

    if (error) {
        return <ErrorBox title="Search failed">{error.message}</ErrorBox>
    }

    return (
        <div className="flex flex-col gap-2 h-full w-full">
            <div className="flex justify-between items-center flex-shrink-0">
                <DocumentsFacetsNav facets={facets} search={facetSearch} />
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleRefetch} alt="Refresh">
                        <RefreshCw size={16} />
                    </Button>
                    <ContentDispositionButton onUpdate={setIsGridView} />
                </div>
            </div>
            <div className="@container flex-1 overflow-y-auto">
                {/* Documents Display Grid or Table */}
                <DocumentTable objects={objects || []} isLoading={false} layout={layout} onRowClick={onRowClick} highlightRow={selectedIds?.size ? highlightRow : undefined} isGridView={isGridView} />

                {/* Intersection observer target */}
                <div ref={loadMoreRef} className="h-4 w-full" />

                {/* Loading spinner */}
                <div
                    className={clsx(
                        "bg-white dark:bg-gray-800 opacity-80 absolute inset-0 z-50 flex justify-center items-center rounded",
                        isLoading ? "block" : "hidden"
                    )}
                >
                    <Spinner size="xl" />
                </div>
            </div>
        </div>
    )
}
