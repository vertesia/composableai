import { useRef, useState, useEffect } from "react";
import { ColumnLayout, ContentObject, ContentObjectItem, ComplexSearchQuery } from '@vertesia/common';
import {
   
    Button, Divider, ErrorBox, SidePanel, Spinner, useIntersectionObserver, useToast,
    FilterProvider, FilterBtn, FilterBar, FilterClear, Filter as BaseFilter
} from '@vertesia/ui/core';
import { useNavigate } from "@vertesia/ui/router";
import { TypeRegistry, useUserSession } from '@vertesia/ui/session';
import { Download, RefreshCw, Eye } from 'lucide-react';
import { useDocumentFilterGroups, useDocumentFilterHandler } from "../../facets/DocumentsFacetsNav";
import { VectorSearchWidget } from './components/VectorSearchWidget';
import { ContentDispositionButton } from './components/ContentDispositionButton';
import { DocumentTable } from './DocumentTable';
import { ExtendedColumnLayout } from './layout/DocumentTableColumn';
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
    const [actualLayout, setActualLayout] = useState<ColumnLayout[]>(
        typeRegistry ? layout || getTableLayout(typeRegistry, search.query.type) : defaultLayout,
    );
    //TODO _setRefreshTrigger state not used
    const [refreshTrigger, _setRefreshTrigger] = useState(0);
    const [loaded, setLoaded] = useState(0);
    const [isGridView, setIsGridView] = useState(localStorage.getItem(ContentDispositionButton.LAST_DISPLAYED_VIEW) === "grid");
    const [filters, setFilters] = useState<BaseFilter[]>([]);

    const loadMoreRef = useRef<HTMLDivElement>(null);
    
    // Trigger initial search when component mounts
    useEffect(() => {
        if (!isReady && objects.length === 0) {
            // Manually set loading state to show spinner during initial load
            search._updateRunningState(true);
            search.search().then(() => {
                setIsReady(true);
            }).catch(err => {
                console.error('Initial search failed:', err);
                search._updateRunningState(false);
            });
        }
    }, []);

    useIntersectionObserver(loadMoreRef, () => {
        if (isReady && objects.length > 0 && objects.length != loaded) {
            setIsReady(false);
            search.loadMore().finally(() => {
                setLoaded(objects.length)
                setIsReady(true);
            });
        }
    }, { deps: [isReady, objects.length] });


    // Handler for vector search widget
    const handleVectorSearch = (query?: ComplexSearchQuery) => {
        if (query && query.vector) {
            search.query.vector = query.vector;
            search.query.full_text = query.full_text;
            search.query.weights = query.weights;
            search.query.score_aggregation = query.score_aggregation;
            search.query.dynamic_scaling = query.dynamic_scaling;
            if (!actualLayout.find((c) => c.name === "Search Score")) {
                const layout = [
                    ...actualLayout,
                    {
                        name: "Search Score",
                        field: "score",
                        render: (item) => (item as any).score?.toFixed(4) || "0.0000"
                    } satisfies ExtendedColumnLayout,
                ];
                setActualLayout(layout);
            }
            search.search().then(() => setIsReady(true));
        } else if (query && query.full_text) {
            search.query.full_text = query.full_text;
            search.search().then(() => setIsReady(true));
        } else {
            delete search.query.vector;
            delete search.query.full_text;
            search.search().then(() => setIsReady(true));
        }
    };

    const facets = useWatchDocumentSearchFacets();
    const facetSearch = useDocumentSearch();

    const handleRefetch = () => {
        search.search().then(() => setIsReady(true));
    };

    // Use DocumentsFacetsNav hooks for cleaner organization
    const filterGroups = useDocumentFilterGroups(facets);
    const handleFilterLogic = useDocumentFilterHandler(facetSearch);

    const handleFilterChange: React.Dispatch<React.SetStateAction<BaseFilter[]>> = (value) => {
        const newFilters = typeof value === 'function' ? value(filters) : value;
        setFilters(newFilters);
        handleFilterLogic(newFilters);
    };

    const url = new URL(window.location.href);
    const filtersParam = url.searchParams.get('filters');

    if (filtersParam) {
        try {
            const filterPairs = filtersParam.split(';');
            const validFilterPairs = filterPairs.filter(pair => {
                const [encodedName] = pair.split(':');
                const name = decodeURIComponent(encodedName);
                return name !== 'start' && name !== 'end';
            });

            if (validFilterPairs.length !== filterPairs.length) {
                const newFiltersParam = validFilterPairs.length > 0 ? validFilterPairs.join(';') : '';
                if (newFiltersParam) {
                    url.searchParams.set('filters', newFiltersParam);
                } else {
                    url.searchParams.delete('filters');
                }
                window.history.replaceState({}, '', url.toString());
            }
        } catch (error) {
            console.error("Failed to clean start/end filters from URL:", error);
        }
    }

    return (
        <div className="flex flex-col gap-y-2">
            <OverviewDrawer object={selectedObject} onClose={() => setSelectedObject(null)} />
            {
                error && <ErrorBox title="Error">{error.message}</ErrorBox>
            }
            {
                allowFilter && (
                    <FilterProvider
                        filterGroups={filterGroups}
                        filters={filters}
                        setFilters={handleFilterChange}
                    >
                        <div className="flex flex-row gap-4 items-center justify-between w-full">
                            <div className="flex gap-2 items-center w-2/3">
                                {
                                    allowSearch && <VectorSearchWidget onChange={handleVectorSearch} isLoading={isLoading} refresh={refreshTrigger} className="w-full" />
                                }
                                <FilterBtn />
                            </div>
                            <div className="flex gap-1 items-center">
                                <Button variant="outline" onClick={handleRefetch} alt="Refresh"><RefreshCw size={16} /></Button>
                                <ContentDispositionButton onUpdate={setIsGridView} />
                            </div>
                        </div>
                        <div className="flex gap-2 items-center">
                            <FilterBar />
                            <FilterClear />
                        </div>
                    </FilterProvider>
                )
            }
            {
                !allowFilter && (
                    <div className="flex flex-row gap-4 items-center justify-between w-full">
                        <div className="flex gap-2 items-center w-2/3">
                            {
                                allowSearch && <VectorSearchWidget onChange={handleVectorSearch} isLoading={isLoading} refresh={refreshTrigger} />
                            }
                        </div>
                        <div className="flex gap-1 items-center">
                            <Button variant="outline" onClick={handleRefetch} alt="Refresh"><RefreshCw size={16} /></Button>
                            <ContentDispositionButton onUpdate={setIsGridView} />
                        </div>
                    </div>
                )
            }
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
                    <Eye className="size-4" />
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
