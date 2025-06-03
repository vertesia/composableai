import { useCallback } from 'react';

import { useToast } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';

import { useDocumentSearch } from '@vertesia/ui/features';
import { useObjectsActionContext } from '../ObjectsActionContext';
import { ActionComponentTypeProps, ObjectsActionSpec } from '../ObjectsActionSpec';
import ConfirmAction from './ConfirmAction';

function RemoveFromCollectionActionComponent({ action, objectIds, collectionId }: ActionComponentTypeProps) {
    const ctx = useObjectsActionContext();

    const toast = useToast();
    const { client } = useUserSession();
    const search = useDocumentSearch();

    const callback = useCallback(() => {
        if (!objectIds || !objectIds.length) {
            toast({
                status: 'error',
                title: 'No objects selected',
                description: 'Please select objects to remove from collection',
                duration: 3000
            });
            return Promise.resolve(false);
        }

        if (!collectionId) {
            toast({
                status: 'error',
                title: 'No collection context',
                description: 'Cannot remove objects: no collection specified',
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
                title: 'Error removing objects from collection',
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

export const RemoveFromCollectionAction: ObjectsActionSpec = {
    id: 'removeFromCollection',
    name: 'Remove from Collection',
    description: 'Remove the selected objects from this collection',
    confirm: true,
    confirmationText: 'Are you sure you want to remove the selected objects from this collection?',
    component: RemoveFromCollectionActionComponent,
    destructive: true
}