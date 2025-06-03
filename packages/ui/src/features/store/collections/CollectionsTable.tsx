import { NavLink } from "@vertesia/ui/router";
import { useUserSession } from "@vertesia/ui/session";
import { FolderClosed, Search, Trash2 } from "lucide-react";
import { Button, ConfirmModal, ErrorBox, Table, TBody, TR, useToast, VTooltip } from "@vertesia/ui/core";
import { useFetch } from "@vertesia/ui/core";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useState, useEffect } from "react";

dayjs.extend(relativeTime);

interface CollectionsTableProps {
}
export function CollectionsTable({ }: CollectionsTableProps) {
    const { client } = useUserSession();
    const toast = useToast();
    const [collectionToDelete, setCollectionToDelete] = useState<string | undefined>();
    const [isLoading, setIsLoading] = useState(true);

    const { data: collections, error, refetch } = useFetch(() => client.store.collections.list(), []);
    
    // Update loading state when data is fetched
    useEffect(() => {
        if (collections || error) {
            setIsLoading(false);
        }
    }, [collections, error]);

    if (error) {
        return <ErrorBox title='Collections fetch failed'>{error.message}</ErrorBox>
    }

    const deleteCollection = async () => {
        if (!collectionToDelete) return;
        
        try {
            await client.store.collections.delete(collectionToDelete);
            toast({
                title: 'Collection deleted',
                status: 'success',
                duration: 3000
            });
            refetch();
        } catch (err: any) {
            console.error('Failed to delete collection:', err);
            toast({
                title: 'Failed to delete collection',
                description: err.message || 'An error occurred',
                status: 'error',
                duration: 5000
            });
        } finally {
            setCollectionToDelete(undefined);
        }
    };

    return (
        <>
            {collections && <Table className="w-full">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Created</th>
                        <th></th>
                    </tr>
                </thead>
                <TBody columns={4} isLoading={isLoading}>
                    {
                        collections.map((c) => {
                            return <TR key={c.id}>
                                <td>
                                    <div className="flex items-center gap-2">
                                        {collectionIcon(c.dynamic)}
                                        <NavLink href={`/collections/${c.id}`}>{c.name}</NavLink>
                                    </div>
                                </td>
                                <td>{c.type?.name || "-"}</td>
                                <td>{dayjs(c.created_at).fromNow()}</td>
                                <td className="text-right">
                                    <Button 
                                        variant="destructive" 
                                        size="sm"
                                        onClick={() => setCollectionToDelete(c.id)}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </td>
                            </TR>
                        })
                    }
                </TBody>
            </Table>}
            
            <ConfirmModal
                isOpen={!!collectionToDelete}
                title="Delete Collection"
                content="Are you sure you want to delete this collection? This action cannot be undone."
                onConfirm={deleteCollection}
                onCancel={() => setCollectionToDelete(undefined)}
            />
        </>
    )
}

export function collectionIcon(isDynamic: boolean) {
    const tooltipText = isDynamic ? "Dynamic Collection" : "Static Collection";
    const icon = isDynamic ? <Search className="size-5" /> : <FolderClosed className="size-5" />;

    return (
        <VTooltip description={tooltipText} className="mr-2">
            {icon}
        </VTooltip>
    );
}