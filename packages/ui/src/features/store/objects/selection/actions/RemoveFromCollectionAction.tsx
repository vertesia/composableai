import { useCallback } from 'react';

import { useToast } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';

import { useUITranslation } from '../../../../../i18n/index.js';
import { i18nInstance, NAMESPACE } from '../../../../../i18n/instance.js';
import { useDocumentSearch } from '../../search';
import { useObjectsActionContext } from '../ObjectsActionHooks';
import { ActionComponentTypeProps, ObjectsActionSpec } from '../ObjectsActionSpec';
import ConfirmAction from './ConfirmAction';

export function RemoveFromCollectionActionComponent({ action, objectIds, collectionId }: ActionComponentTypeProps) {
    const { t } = useUITranslation();
    const ctx = useObjectsActionContext();

    const toast = useToast();
    const { client } = useUserSession();
    const search = useDocumentSearch();

    const callback = useCallback(() => {
        if (!objectIds || !objectIds.length) {
            toast({
                status: 'error',
                title: t('store.actions.noObjectsSelected'),
                description: t('store.actions.pleaseSelectObjectsToRemove'),
                duration: 3000
            });
            return Promise.resolve(false);
        }

        if (!collectionId) {
            toast({
                status: 'error',
                title: t('store.actions.noCollectionContext'),
                description: t('store.actions.cannotRemoveNoCollection'),
                duration: 3000
            });
            return Promise.resolve(false);
        }

        return client.store.collections.deleteMembers(collectionId, objectIds).then(() => {
            const plural = objectIds.length > 1 ? 's' : '';
            toast({
                status: 'success',
                title: `${objectIds.length} object${plural} removed from collection`,
                description: `Objects have been removed from the collection`,
                duration: 2000
            });

            if (search) {
                ctx.params?.selection?.removeAll();
                search.search();
            }
        }).catch((err: any) => {
            toast({
                status: 'error',
                title: t('store.actions.errorRemovingObjects'),
                description: err.message,
                duration: 5000
            });
        });
    }, [objectIds, collectionId]);

    return (
        <ConfirmAction action={action} callback={callback}>
            {/* Action component content if needed */}
        </ConfirmAction>
    )
}

const t_static = i18nInstance.getFixedT(null, NAMESPACE);
export const RemoveFromCollectionAction: ObjectsActionSpec = {
    id: 'removeFromCollection',
    name: t_static('store.actions.removeFromCollection'),
    description: t_static('store.actions.removeFromCollectionDesc'),
    confirm: true,
    confirmationText: t_static('store.actions.confirmRemoveFromCollection'),
    component: RemoveFromCollectionActionComponent,
    destructive: true
}