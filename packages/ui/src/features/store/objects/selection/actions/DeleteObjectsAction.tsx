import { useCallback } from 'react';

import { useToast } from '@vertesia/ui/core';
import { useNavigate } from "@vertesia/ui/router";
import { useUserSession } from '@vertesia/ui/session';

import { useDocumentSearch } from '../../search/DocumentSearchContext';
import { useObjectsActionContext } from '../ObjectsActionContext';
import { ActionComponentTypeProps, ObjectsActionSpec } from '../ObjectsActionSpec';
import ConfirmAction from './ConfirmAction';

export function DeleteObjectsActionComponent({ action, objectIds, children }: ActionComponentTypeProps) {
    const ctx = useObjectsActionContext();

    const toast = useToast();
    const { client } = useUserSession();
    const search = useDocumentSearch();
    const navigate = useNavigate();

    const callback = useCallback(() => {
        if (!objectIds || !objectIds.length) {
            toast({
                status: 'error',
                title: 'No objects selected',
                description: 'Please select objects to delete',
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
                title: 'Error deleting objects',
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

export const DeleteObjectsAction: ObjectsActionSpec = {
    id: 'delete',
    name: 'Delete',
    description: 'Delete the selected objects',
    confirm: true,
    confirmationText: 'Are you sure you want to delete all the selected objects? This action cannot be undone.',
    component: DeleteObjectsActionComponent,
    destructive: true
}


export const DeleteObjectsFromCollectionsAction: ObjectsActionSpec = {
    id: 'deleteFromCollections',
    name: 'Delete Objects',
    description: 'Delete the selected objects',
    confirm: true,
    confirmationText: 'Are you sure you want to delete the selected objects?\nThis is not removable from collections.',
    component: DeleteObjectsActionComponent,
    destructive: true
}
