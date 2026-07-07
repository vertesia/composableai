import { ConfirmModal, useToast } from '@vertesia/ui/core';
import { i18nInstance, NAMESPACE, useUITranslation } from '@vertesia/ui/i18n';
import { useNavigate } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import { useCallback, useState } from 'react';
import { useDocumentSearch } from '../../search/DocumentSearchContext';
import { useObjectsActionCallback, useObjectsActionContext } from '../ObjectsActionHooks';
import type { ActionComponentTypeProps, ObjectsActionSpec } from '../ObjectsActionSpec';

export function DeleteObjectsActionComponent({ action, objectIds, children }: ActionComponentTypeProps) {
    const { t } = useUITranslation();
    const ctx = useObjectsActionContext();

    const toast = useToast();
    const { client } = useUserSession();
    const search = useDocumentSearch();
    const navigate = useNavigate();

    const [showConfirm, setShowConfirm] = useState(false);

    const count = objectIds?.length ?? 0;
    const type = ctx.params?.type?.name ?? 'object';

    // Register the action trigger; opening the confirm modal is the action "callback".
    const openConfirm = useCallback(() => {
        setShowConfirm(true);
        return Promise.resolve(true);
    }, []);
    useObjectsActionCallback(action.id, openConfirm);

    const handleDelete = useCallback(() => {
        setShowConfirm(false);
        if (!objectIds?.length) {
            toast({
                status: 'error',
                title: t('store.actions.noObjectsSelected'),
                description: t('store.actions.pleaseSelectObjectsToDelete'),
                duration: 3000,
            });
            return Promise.resolve(false);
        }

        return client.store.objects
            .delete(objectIds)
            .then((result) => {
                const plural = result.deleted > 1 ? 's' : '';
                toast({
                    status: 'success',
                    title: `${result.deleted} object${plural} deleted`,
                    duration: 2000,
                });
                if (result.failed.length > 0) {
                    toast({
                        status: 'warning',
                        title: `${result.failed.length} object(s) could not be deleted`,
                        duration: 3000,
                    });
                }

                if (search) {
                    // we are in the objects table view
                    ctx.params?.selection?.removeAll();
                    const facets = JSON.parse(JSON.stringify(search.facets));
                    if (objectIds.length === facets._value.total) {
                        search.resetFacets();
                    }
                    search.search();
                } else {
                    // we are in the object view
                    // go back to the parent
                    navigate('/objects');
                }
            })
            .catch((err) => {
                toast({
                    status: 'error',
                    title: t('store.actions.errorDeletingObjects'),
                    description: err.message,
                    duration: 5000,
                });
            });
    }, [
        client.store.objects.delete,
        ctx.params?.selection?.removeAll,
        navigate,
        objectIds,
        search,
        search?.facets,
        search?.resetFacets,
        search?.search,
        t,
        toast,
    ]);

    return (
        <>
            {children}
            <ConfirmModal
                isOpen={showConfirm}
                title={count === 1 ? `Delete ${type}` : `Delete ${type}s`}
                content={
                    <div>
                        <p>
                            Delete {count} selected {type}
                            {count === 1 ? '' : 's'}? {count === 1 ? `This ${type}` : `These ${type}s`} will be
                            permanently removed.
                        </p>
                        <p>
                            <span className="text-destructive">This action cannot be undone.</span>
                        </p>
                    </div>
                }
                onConfirm={handleDelete}
                onCancel={() => setShowConfirm(false)}
                confirmationValue="delete"
                confirmationLabel='Type "delete" to confirm'
                confirmationPlaceholder="delete"
            />
        </>
    );
}

const t = i18nInstance.getFixedT(null, NAMESPACE);
export const DeleteObjectsAction: ObjectsActionSpec = {
    id: 'delete',
    name: t('store.actions.delete'),
    description: t('store.actions.deleteTheSelectedObjects'),
    confirm: true,
    confirmationText: t('store.actions.confirmDeleteAll'),
    component: DeleteObjectsActionComponent,
    destructive: true,
};

export const DeleteObjectsFromCollectionsAction: ObjectsActionSpec = {
    id: 'deleteFromCollections',
    name: t('store.actions.deleteObjects'),
    description: t('store.actions.deleteTheSelectedObjects'),
    confirm: true,
    confirmationText: t('store.actions.confirmDeleteSelected'),
    component: DeleteObjectsActionComponent,
    destructive: true,
};
