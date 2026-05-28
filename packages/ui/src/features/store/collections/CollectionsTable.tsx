import {
    Button,
    ConfirmModal,
    EmptyCollection,
    ErrorBox,
    errorMessage,
    Table,
    TBody,
    TR,
    useFetch,
    useToast,
    VTooltip,
} from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { NavLink } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { FolderClosed, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CreateCollectionModal } from './CreateCollection';

dayjs.extend(relativeTime);

export function CollectionsTable() {
    const { client } = useUserSession();
    const toast = useToast();
    const { t } = useUITranslation();
    const [collectionToDelete, setCollectionToDelete] = useState<string | undefined>();
    const [isLoading, setIsLoading] = useState(true);
    const [isOpen, setOpen] = useState(false);

    const { data: collections, error, refetch } = useFetch(() => client.store.collections.search({}), []);

    // Update loading state when data is fetched
    useEffect(() => {
        if (collections || error) {
            setIsLoading(false);
        }
    }, [collections, error]);

    if (error) {
        return <ErrorBox title={t('store.collectionFetchFailed')}>{errorMessage(error)}</ErrorBox>;
    }

    const deleteCollection = async () => {
        if (!collectionToDelete) return;

        try {
            await client.store.collections.delete(collectionToDelete);
            toast({
                title: t('store.collectionDeleted'),
                status: 'success',
                duration: 3000,
            });
            refetch();
        } catch (err: unknown) {
            console.error('Failed to delete collection:', err);
            toast({
                title: t('store.failedToDeleteCollection'),
                description: errorMessage(err),
                status: 'error',
                duration: 5000,
            });
        } finally {
            setCollectionToDelete(undefined);
        }
    };

    return (
        <>
            {collections &&
                (collections.length > 0 ? (
                    <Table className="w-full">
                        <thead>
                            <tr>
                                <th>{t('type.name')}</th>
                                <th>{t('type.type')}</th>
                                <th>{t('store.created')}</th>
                                <th></th>
                            </tr>
                        </thead>
                        <TBody columns={4} isLoading={isLoading}>
                            {collections.map((c) => {
                                return (
                                    <TR key={c.id}>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <CollectionIcon isDynamic={c.dynamic} />
                                                <NavLink href={`/collections/${c.id}`}>{c.name}</NavLink>
                                            </div>
                                        </td>
                                        <td>{c.type?.name || '-'}</td>
                                        <td>{dayjs(c.created_at).fromNow()}</td>
                                        <td className="text-end">
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => setCollectionToDelete(c.id)}
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </td>
                                    </TR>
                                );
                            })}
                        </TBody>
                    </Table>
                ) : (
                    <EmptyCollection
                        title={t('store.noCollections')}
                        buttonLabel={t('store.newCollections')}
                        onClick={() => setOpen(true)}
                    >
                        {t('store.getStartedCollections')}
                    </EmptyCollection>
                ))}

            <CreateCollectionModal isOpen={isOpen} onClose={() => setOpen(false)} />

            <ConfirmModal
                isOpen={!!collectionToDelete}
                title={t('store.deleteCollection')}
                content={t('store.areYouSureDeleteCollection')}
                onConfirm={deleteCollection}
                onCancel={() => setCollectionToDelete(undefined)}
            />
        </>
    );
}

export function CollectionIcon({ isDynamic }: { isDynamic: boolean }) {
    const { t } = useUITranslation();
    const tooltipText = isDynamic ? t('store.dynamicCollection') : t('store.staticCollection');
    const icon = isDynamic ? <Search className="size-5" /> : <FolderClosed className="size-5" />;

    return (
        <VTooltip description={tooltipText} className="me-2">
            {icon}
        </VTooltip>
    );
}
