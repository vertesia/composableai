import { ColumnLayout, ComplexSearchQuery, ContentObject, ContentObjectItem } from '@vertesia/common';
import {
    Filter as BaseFilter,
    Button, Divider, ErrorBox,
    FilterBar,
    FilterBtn,
    FilterClear,
    FilterProvider,
    SidePanel, Spinner, useIntersectionObserver, useToast
} from '@vertesia/ui/core';
import { useNavigate } from "@vertesia/ui/router";
import { useUserSession } from '@vertesia/ui/session';
import { TypeRegistry } from '../types/TypeRegistry.js';
import { useTypeRegistry } from '../types/TypeRegistryProvider.js';
import { Download, ExternalLink, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from "react";
import { useDocumentFilterGroups, useDocumentFilterHandler } from "../../facets/DocumentsFacetsNav";
import { ContentDispositionButton } from './components/ContentDispositionButton';
import { ContentOverview } from './components/ContentOverview';
import { useDownloadFile } from './components/useDownloadFile';
import { VectorSearchWidget } from './components/VectorSearchWidget';
import { DocumentTable } from './DocumentTable';
import { ExtendedColumnLayout } from './layout/DocumentTableColumn';
import { useDocumentSearch, useWatchDocumentSearchFacets, useWatchDocumentSearchResult } from './search/DocumentSearchContext';
import { useDocumentUploadHandler } from './upload/useUploadHandler';

const defaultLayout: ColumnLayout[] = [
    { name: "ID", field: "id", type: "objectId?slice=-7" },
    { name: "Name", field: ".", type: "objectName" },
    { name: "Type", field: "type.name", type: "string" },
    { name: "Status", field: "status", type: "string" },
    { name: "Updated At", field: "updated_at", type: "date" },
];

function getTableLayout(registry: TypeRegistry, type: string | undefined): ColumnLayout[] {
    const layout = type ? registry.getTypeLayout(type) : defaultLayout;
    const result = layout ?? defaultLayout;
    return result;
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
    const { registry: typeRegistry } = useTypeRegistry();
    const { search, isLoading, error, objects, hasMore } = useWatchDocumentSearchResult();
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
            setLoaded(0);
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

    useEffect(() => {
        if (objects.length < loaded) {
            setLoaded(objects.length);
        }
    }, [objects.length, loaded]);

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
            if (query.limit !== undefined) {
                search.limit = query.limit;
                search.query.limit = query.limit;
            }
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
            if (query.limit !== undefined) {
                search.limit = query.limit;
                search.query.limit = query.limit;
            }
            search.search().then(() => setIsReady(true));
        } else if (query === undefined) {
            // Only clear search if this is a user-initiated clear (not initialization)
            // The VectorSearchWidget calls onChange(undefined) during initialization
            if (isReady) {
                delete search.query.vector;
                delete search.query.full_text;
                search.search().then(() => setIsReady(true));
            }
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
                window.history.replaceState(window.history.state || {}, '', url.toString());
            }
        } catch (error) {
            console.error("Failed to clean start/end filters from URL:", error);
        }
    }

    const navigate = useNavigate();
    const onRowClick = (object: ContentObjectItem) => {
        navigate(`/objects/${object.id}`);
    }

    const previewObject = (objectId: string) => {
        const obj = objects.find(o => o.id === objectId) || null;
        setSelectedObject(obj);
    }

    return (
        <div className="flex flex-col gap-y-2">
            <OverviewDrawer object={selectedObject} onClose={() => setSelectedObject(null)} />
            {
                error && <ErrorBox title="Error">{error.message}</ErrorBox>
            }
            <Toolsbar
                isLoading={isLoading}
                refreshTrigger={refreshTrigger}
                allowFilter={allowFilter}
                allowSearch={allowSearch}
                filterGroups={filterGroups}
                filters={filters}
                handleFilterChange={handleFilterChange}
                handleVectorSearch={handleVectorSearch}
                handleRefetch={handleRefetch}
                setIsGridView={setIsGridView}
                refetch={handleRefetch}
            />
            <DocumentTable
                objects={objects}
                isLoading={!objects.length && isLoading}
                layout={actualLayout}
                onRowClick={onRowClick}
                previewObject={previewObject}
                selectedObject={selectedObject}
                onUpload={onUpload}
                isGridView={isGridView}
                collectionId={searchContext.collectionId} // Pass the collection ID from context
            />
            {hasMore ? (
                <div ref={loadMoreRef} className="w-full flex justify-center" >
                    <Spinner size='xl' />
                </div>
            ) : (
                <div className="text-muted text-center text-sm py-1">
                    {`All ${objects.length} objects loaded.`}
                </div>
            )}
        </div>
    );
}

interface ToolsbarProps {
    isLoading: boolean;
    refreshTrigger: number;
    allowFilter: boolean;
    allowSearch: boolean;
    filterGroups: ReturnType<typeof useDocumentFilterGroups>;
    filters: BaseFilter[];
    handleFilterChange: React.Dispatch<React.SetStateAction<BaseFilter[]>>;
    handleVectorSearch: (query?: ComplexSearchQuery) => void;
    handleRefetch: () => void;
    setIsGridView: React.Dispatch<React.SetStateAction<boolean>>;
    refetch: () => void;
}
function Toolsbar(props: ToolsbarProps) {
    const {
        isLoading,
        refreshTrigger,
        allowFilter,
        allowSearch,
        filterGroups,
        filters,
        handleFilterChange,
        handleVectorSearch,
        handleRefetch,
        setIsGridView,
        refetch
    } = props;

    return (
        <div className="sticky top-0 z-10 bg-background py-2 flex justify-between items-center">
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
                        </div>
                        <div className="flex gap-2 items-center pt-2">
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
            <Button variant="outline" onClick={refetch} alt="Refresh"><RefreshCw size={16} /></Button>
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
    const { downloadFromContentSource } = useDownloadFile({ client: store, toast });

    return object ? (
        <SidePanel title={object.properties?.title || object.name} isOpen={true} onClose={onClose}>
            <div className="flex items-center gap-x-2">
                <Button variant="ghost" size="sm" title="Open Object" onClick={() => navigate(`/objects/${object.id}`)}>
                    <ExternalLink className="size-4" />
                </Button>
                {object.content?.source && (
                    <Button variant="ghost" size="sm" title="Download" onClick={() => downloadFromContentSource(object.content!.source!, object.name || object.content?.name)}>
                        <Download className="size-4" />
                    </Button>
                )}
            </div>
            <Divider className="my-2" />
            <div className="pt-2">
                <ContentOverview key={object.id} object={object as ContentObject} loadText />
            </div>
        </SidePanel>
    ) : null;
}
