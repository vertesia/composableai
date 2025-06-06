import { ColumnLayout, ContentObjectItem } from "@vertesia/common";
import { ErrorBox, Spinner, useIntersectionObserver } from "@vertesia/ui/core";
import { useEffect, useRef, useState } from "react";
import { VFacetsNav } from "../../../facets";
import { DocumentTable } from "../DocumentTable";
import { useDocumentSearch, useWatchDocumentSearchFacets, useWatchDocumentSearchResult } from "../search/DocumentSearchContext";
import { DocumentSearchProvider } from "../search/DocumentSearchProvider";
import { ContentDispositionButton } from "./ContentDispositionButton";

const layout: ColumnLayout[] = [
    { "name": "Name", "field": "properties.title", "type": "string", "fallback": "name" },
    { "name": "Type", "field": "type.name", "type": "string" },
    { "name": "Status", "field": "status", "type": "string" },
    { "name": "Created At", "field": "created_at", "type": "date" }
];

interface SelectDocumentProps {
    onChange: (value: ContentObjectItem) => void;
    type?: string;
    mimeType?: string;
}
export function SelectDocument({ onChange }: SelectDocumentProps) {
    const onRowClick = (selected: ContentObjectItem) => {
        onChange(selected || undefined);
    }
    return (
        <DocumentSearchProvider>
            <SelectDocumentImpl onRowClick={onRowClick} />
        </DocumentSearchProvider>
    )
}

interface SelectDocumentImplProps {
    onRowClick: (selected: ContentObjectItem) => void;
}
function SelectDocumentImpl({ onRowClick }: SelectDocumentImplProps) {
    const [isReady, setIsReady] = useState(false);
    const [isGridView, setIsGridView] = useState(localStorage.getItem('lastDisplayedView') === 'grid');
    const { search, isLoading, error, objects } = useWatchDocumentSearchResult();

    const loadMoreRef = useRef<HTMLDivElement>(null);
    useIntersectionObserver(loadMoreRef, () => {
        isReady && search.loadMore(true)
    }, { deps: [isReady] });
    useEffect(() => {
        search.search().then(() => setIsReady(true));
    }, []);

    const facets = useWatchDocumentSearchFacets();
    const facetSearch = useDocumentSearch();

    if (error) {
        return <ErrorBox title="Search failed">{error.message}</ErrorBox>
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <VFacetsNav facets={facets} search={facetSearch} textSearch="Filter content" />
                <ContentDispositionButton onUpdate={setIsGridView} />
            </div>
            <DocumentTable objects={objects || []} isLoading={false} layout={layout} onRowClick={onRowClick} isGridView={isGridView} />
            <div ref={loadMoreRef} className='mt-10' />
            {
                isLoading && <div className='flex justify-center'><Spinner size='xl' /></div>
            }
        </div>
    )
}
