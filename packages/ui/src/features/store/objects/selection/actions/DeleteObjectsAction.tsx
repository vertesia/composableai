import { useCallback } from 'react';

import { useToast } from '@vertesia/ui/core';
import { useNavigate } from "@vertesia/ui/router";
import { useUserSession } from '@vertesia/ui/session';

import { useUITranslation } from '../../../../../i18n/index.js';
import { i18nInstance, NAMESPACE } from '../../../../../i18n/instance.js';
import { useDocumentSearch } from '../../search/DocumentSearchContext';
import { useObjectsActionContext } from '../ObjectsActionHooks';
import { ActionComponentTypeProps, ObjectsActionSpec } from '../ObjectsActionSpec';
import ConfirmAction from './ConfirmAction';

export function DeleteObjectsActionComponent({ action, objectIds, children }: ActionComponentTypeProps) {
    const { t } = useUITranslation();
    const ctx = useObjectsActionContext();

    const toast = useToast();
    const { client } = useUserSession();
    const search = useDocumentSearch();
    const navigate = useNavigate();

    const callback = useCallback(() => {
        if (!objectIds || !objectIds.length) {
            toast({
                status: 'error',
                title: t('store.actions.noObjectsSelected'),
                description: t('store.actions.pleaseSelectObjectsToDelete'),
                duration: 3000
            });
            return Promise.resolve(false);
        }

        return client.store.objects.delete(objectIds).then((result) => {
            const plural = result.deleted > 1 ? 's' : '';
            toast({
                status: 'success',
                title: `${result.deleted} object${plural} deleted`,
                duration: 2000
            });
            if (result.failed.length > 0) {
                toast({
                    status: 'warning',
                    title: `${result.failed.length} object(s) could not be deleted`,
                    duration: 3000
                });
            }

            if (search) { // we are in the objects table view
                ctx.params?.selection?.removeAll();
                const facets = JSON.parse(JSON.stringify(search.facets))
                if (objectIds.length === facets._value.total) {
                    search.resetFacets();
                }
                search.search();
            } else {
                // we are in the object view
                // go back to the parent
                navigate("/objects");
            }
        }).catch(err => {
            toast({
                status: 'error',
                title: t('store.actions.errorDeletingObjects'),
                description: err.message,
                duration: 5000
            });
        });
    }, [objectIds]);

    return (
        <ConfirmAction action={action} callback={callback}>
            {children}
        </ConfirmAction>
    )
}

const t = i18nInstance.getFixedT(null, NAMESPACE);
export const DeleteObjectsAction: ObjectsActionSpec = {
    id: 'delete',
    name: t('store.actions.delete'),
    description: t('store.actions.deleteTheSelectedObjects'),
    confirm: true,
    confirmationText: t('store.actions.confirmDeleteAll'),
    component: DeleteObjectsActionComponent,
    destructive: true
}


export const DeleteObjectsFromCollectionsAction: ObjectsActionSpec = {
    id: 'deleteFromCollections',
    name: t('store.actions.deleteObjects'),
    description: t('store.actions.deleteTheSelectedObjects'),
    confirm: true,
    confirmationText: t('store.actions.confirmDeleteSelected'),
    component: DeleteObjectsActionComponent,
    destructive: true
}
