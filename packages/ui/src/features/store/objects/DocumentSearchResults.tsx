import { useEffect, useRef, useState } from "react";

import { ColumnLayout, ContentObject, ContentObjectItem, VectorSearchQuery } from '@vertesia/common';
import { Button, Divider, ErrorBox, SidePanel, Spinner, useDebounce, useIntersectionObserver, useToast } from '@vertesia/ui/core';
import { useNavigate } from "@vertesia/ui/router";
import { TypeRegistry, useUserSession } from '@vertesia/ui/session';
import { Download, RefreshCw, SquareArrowOutUpRight } from 'lucide-react';
import { DocumentsFacetsNav } from "../../facets";
import { VectorSearchWidget } from './components/VectorSearchWidget';

import { ContentDispositionButton } from './components/ContentDispositionButton';
import { DocumentTable } from './DocumentTable';
import { useDocumentSearch, useWatchDocumentSearchFacets, useWatchDocumentSearchResult } from './search/DocumentSearchContext';
import { useDocumentUploadHandler } from './upload/useUploadHandler';
import { ContentOverview } from './components/ContentOverview';
import { useDownloadDocument } from './components/useDownloadObject';

const defaultLayout: ColumnLayout[] = [
    { name: "ID", field: "id", type: "string?slice=-7" },
    { name: "Name", field: ".", type: "objectLink" },
    { name: "Type", field: "type.name", type: "string" },
    { name: "Status", field: "status", type: "string" },
    { name: "Updated At", field: "updated_at", type: "date" },
];

function getTableLayout(registry: TypeRegistry, type: string | undefined): ColumnLayout[] {
    const layout = type ? registry.getTypeLayout(type) : defaultLayout;
    return layout ?? defaultLayout;
}

interface DocumentSearchResultsWithDropZoneProps {
    layout?: ColumnLayout[];
    /**
     * Callback to be called after upload is done
     * @param objectIds the created object ids
     * @returns
     */
    onUploadDone?: (objectIds: string[]) => Promise<void>;
}
export function DocumentSearchResultsWithDropZone({ onUploadDone = async () => { }, layout }: DocumentSearchResultsWithDropZoneProps) {
    const search = useDocumentSearch();
    const toast = useToast();

    // Create a wrapper around the onUploadDone callback that also refreshes the search
    const handleUploadDone = async (objectIds: string[]) => {
        // First, call the original callback
        await onUploadDone(objectIds);

        // Use a timeout to let the backend catch up, then refresh the search results
        setTimeout(() => {
            console.log('Delayed refresh after upload to ensure backend consistency');
            search.search().then(() => {
                // Notify the user that the list has been refreshed
                toast({
                    title: "Document list refreshed",
                    description: "The document list has been updated with your uploaded files.",
                    status: "info",
                    duration: 3000,
                });
            }).catch(err => {
                console.error('Failed to refresh search results:', err);
            });
        }, 1000); // 1-second delay for backend processing
    };

    // Use the enhanced standard upload handler with smart processing
    const uploadHandler = useDocumentUploadHandler(handleUploadDone);

    // Wrap the uploadHandler to ensure the collectionId is passed
    const wrappedUploadHandler = (files: File[], type: string | null) => {
        // Get the collection ID from the search context
        const collectionId = search.collectionId;
        return uploadHandler(files, type, collectionId);
    };

    return <DocumentSearchResults layout={layout} onUpload={wrappedUploadHandler} />;
}

interface DocumentSearchResultsProps {
    layout?: ColumnLayout[];
    allowFilter?: boolean;
    allowSearch?: boolean;
    onUpload?: (files: File[], type: string | null, collectionId?: string) => Promise<unknown>; // if defined, accept drag drop to upload
}
export function DocumentSearchResults({ layout, onUpload, allowFilter = true, allowSearch = true }: DocumentSearchResultsProps) {
    // Get the search context to access collectionId
    const searchContext = useDocumentSearch();
    const [isReady, setIsReady] = useState(false);
    const [selectedObject, setSelectedObject] = useState<ContentObjectItem | null>(null);
    const { typeRegistry } = useUserSession();
    const { search, isLoading, error, objects } = useWatchDocumentSearchResult();
    const [vQuery, setVQuery] = useState<VectorSearchQuery | undefined>(undefined);
    const [actualLayout, setActualLayout] = useState<ColumnLayout[]>(
        typeRegistry ? layout || getTableLayout(typeRegistry, search.query.type) : defaultLayout,
    );
    //TODO _setRefreshTrigger state not used
    const [refreshTrigger, _setRefreshTrigger] = useState(0);
    const [loaded, setLoaded] = useState(0);
    const [isGridView, setIsGridView] = useState(localStorage.getItem(ContentDispositionButton.LAST_DISPLAYED_VIEW) === "grid");

    const loadMoreRef = useRef<HTMLDivElement>(null);
    useIntersectionObserver(loadMoreRef, () => {
        if (isReady && objects.length > 0 && objects.length != loaded) {
            setIsReady(false);
            search.loadMore().finally(() => {
                setLoaded(objects.length)
                setIsReady(true);
            });
        }
    }, { deps: [isReady, objects.length] });

    useEffect(() => {
        search.search().then(() => setIsReady(true));
    }, []);

    //TODO _setSearchTerm state not used
    const [searchTerm, _setSearchTerm] = useState("");
    const debounceValue = useDebounce(searchTerm, 500);
    useEffect(() => {
        search.query.name = searchTerm;
        search.search().then(() => setIsReady(true));
    }, [debounceValue]);

    useEffect(() => {
        if (vQuery) {
            search.query.vector = vQuery;
            if (!actualLayout.find((c) => c.name === "Vector Similarity")) {
                const layout = [
                    ...actualLayout,
                    {
                        name: "Vector Similarity",
                        field: "score",
                    } satisfies ColumnLayout,
                ];
                setActualLayout(layout);
            }
            search.search().then(() => setIsReady(true));
        } else {
            delete search.query.vector;
            search.search().then(() => setIsReady(true));
        }
    }, [vQuery?.values]);

    const facets = useWatchDocumentSearchFacets();
    const facetSearch = useDocumentSearch();

    const handleRefetch = () => {
        search.search().then(() => setIsReady(true));
    };

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('filters')) {
        urlParams.delete('filters');
        window.history.replaceState({}, '', `${window.location.pathname}?${urlParams.toString()}`);
    }

    return (
        <div className="flex flex-col gap-y-2">
            <OverviewDrawer object={selectedObject} onClose={() => setSelectedObject(null)} />
            {
                error && <ErrorBox title="Error">{error.message}</ErrorBox>
            }
            <div className="flex flex-row gap-4 items-center justify-between w-full">
                {
                    allowSearch && <VectorSearchWidget onChange={setVQuery} isLoading={isLoading} refresh={refreshTrigger} />
                }
                <div className="flex gap-1 items-center">
                    <Button variant="outline" onClick={handleRefetch} alt="Refresh"><RefreshCw size={16} /></Button>
                    <ContentDispositionButton onUpdate={setIsGridView} />
                </div>
            </div>
            {allowFilter && <DocumentsFacetsNav facets={facets} search={facetSearch} textSearch={"Name or ID"} />}
            <DocumentTable
                objects={objects}
                isLoading={!objects.length && isLoading}
                layout={actualLayout}
                onRowClick={setSelectedObject}
                onUpload={onUpload}
                isGridView={isGridView}
                collectionId={searchContext.collectionId} // Pass the collection ID from context
            />
            {
                isLoading && <div className='flex justify-center'><Spinner size='xl' /></div>
            }
            <div ref={loadMoreRef} />
        </div>
    );
}

interface OverviewDrawerProps {
    object: ContentObjectItem | null;
    onClose: () => void;
}
function OverviewDrawer({ object, onClose }: OverviewDrawerProps) {
    const { store } = useUserSession();
    const toast = useToast();
    const navigate = useNavigate();
    const onDownload = useDownloadDocument(store, toast, object?.content?.source);

    return object ? (
        <SidePanel title={object.properties?.title || object.name} isOpen={true} onClose={onClose}>
            <div className="flex items-center gap-x-2">
                <Button variant="ghost" size="sm" title="Open Object" onClick={() => navigate(`/objects/${object.id}`)}>
                    <SquareArrowOutUpRight className="size-4" />
                </Button>
                {object.content?.source && (
                    <Button variant="ghost" size="sm" title="Download" onClick={onDownload}>
                        <Download className="size-4" />
                    </Button>
                )}
            </div>
            <Divider className="my-2" />
            <div className="pt-2">
                <ContentOverview object={object as unknown as ContentObject} loadText />
            </div>
        </SidePanel>
    ) : null;
}
