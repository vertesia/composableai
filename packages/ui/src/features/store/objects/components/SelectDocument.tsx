import { ColumnLayout, ContentObjectItem } from "@vertesia/common";
import { Button, ErrorBox, Spinner, useIntersectionObserver } from "@vertesia/ui/core";
import { useEffect, useRef, useState } from "react";
import { VFacetsNav } from "../../../facets";
import { DocumentTable } from "../DocumentTable";
import { useDocumentSearch, useWatchDocumentSearchFacets, useWatchDocumentSearchResult } from "../search/DocumentSearchContext";
import { DocumentSearchProvider } from "../search/DocumentSearchProvider";
import { ContentDispositionButton } from "./ContentDispositionButton";
import { RefreshCw } from "lucide-react";

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
const LAST_DISPLAYED_VIEW = 'vertesia.content_store.lastDisplayedView'

function SelectDocumentImpl({ onRowClick }: SelectDocumentImplProps) {
    const [isReady, setIsReady] = useState(false);
    const [isGridView, setIsGridView] = useState(localStorage.getItem(LAST_DISPLAYED_VIEW) === 'grid');
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

    const handleRefetch = () => {
        setIsReady(false);
        search.search().then(() => setIsReady(true));
    }

    if (error) {
        return <ErrorBox title="Search failed">{error.message}</ErrorBox>
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <VFacetsNav facets={facets} search={facetSearch} textSearch="Filter content" />
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleRefetch} alt="Refresh">
                        <RefreshCw size={16} />
                    </Button>
                    <ContentDispositionButton onUpdate={setIsGridView} />
                </div>
            </div>
            <DocumentTable objects={objects || []} isLoading={false} layout={layout} onRowClick={onRowClick} isGridView={isGridView} />
            <div ref={loadMoreRef} className='mt-10' />
            {
                isLoading && <div className='flex justify-center'><Spinner size='xl' /></div>
            }
        </div>
    )
}
