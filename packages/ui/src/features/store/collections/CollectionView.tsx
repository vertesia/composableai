import { Collection, FacetSpec } from "@vertesia/common";
import { ErrorBox, Spinner, useFetch, VTabs, VTabsBar, VTabsPanel } from "@vertesia/ui/core";
import { FullHeightLayout } from "@vertesia/ui/layout";
import { NavLink } from "@vertesia/ui/router";
import { useUserSession } from "@vertesia/ui/session";
import { PanelErrorBoundary } from "../../errors";
import { GenericPageNavHeader } from "../../layout";
import { DocumentSearchProvider, DocumentSelectionProvider } from "../../store";
import { SelectionActions, UploadObjectsButton } from "../objects/selection/SelectionActions";
import { BrowseCollectionView } from "./BrowseCollectionView";
import { EditCollectionView } from "./EditCollectionView";

const facets: FacetSpec[] = [
    {
        name: 'status',
        field: 'status'
    },
    {
        name: 'type',
        field: 'type'
    }
];


interface CollectionViewProps {
    collectionId: string;
}
export function CollectionView({ collectionId }: CollectionViewProps) {
    const { client } = useUserSession();

    const { data: collection, error, refetch, isLoading } = useFetch(() => client.store.collections.retrieve(collectionId), [collectionId]);

    if (error) {
        return <ErrorBox title='Collection fetch failed'>{error.message}</ErrorBox>
    }

    const actions = [
        <SelectionActions key='selection' />,
        <UploadObjectsButton key="upload" collectionId={collectionId ?? ''} />
    ];

    const title = (
        <div className='flex gap-x-1 items-center'>
            <div>{collection?.name || ''}</div>
        </div>
    )

    const breadcrumbs = [
        <NavLink href='/collections' key='collections'>Collections</NavLink>,
        <span key='collection-detail'>Collection Detail</span>
    ];

    const tabs = [
        {
            name: 'browse',
            label: 'Browse',
            content: <BrowseCollectionView collection={collection as Collection} />
        },
        {
            name: 'metadata',
            label: 'Metadata',
            content: <EditCollectionView collection={collection as Collection} refetch={refetch} />
        }
    ];

    return (
        <FullHeightLayout>
            <DocumentSearchProvider facets={facets} collectionId={collectionId}>
                <DocumentSelectionProvider collectionId={collectionId}>
                    <GenericPageNavHeader title={title}
                        description={collection?.description || ''}
                        actions={actions}
                        breadcrumbs={breadcrumbs}
                    />
                    <VTabs defaultValue="browse" tabs={tabs}>
                        <VTabsBar className="px-4" />
                        {
                            isLoading ?
                                <div className="w-full flex justify-center">
                                    <Spinner />
                                </div> :
                                <div className="h-[calc(100vh-165px)] overflow-auto px-4 py-2">
                                    <PanelErrorBoundary>
                                        <VTabsPanel />
                                    </PanelErrorBoundary>
                                </div>
                        }
                    </VTabs>

                </DocumentSelectionProvider>
            </DocumentSearchProvider>
        </FullHeightLayout>
    )
}
