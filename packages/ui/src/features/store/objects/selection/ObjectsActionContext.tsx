import type { ContentObjectTypeItem } from '@vertesia/common';
import { useToast } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';
import { type ReactNode, useMemo } from 'react';

import { useDocumentSelection } from '../DocumentSelectionProvider';
import { useDocumentSearch } from '../search/DocumentSearchContext';
import { AddToCollectionAction } from './actions/AddToCollectionAction';
import { ChangeTypeAction } from './actions/ChangeTypeAction';
import { DeleteObjectsAction, DeleteObjectsFromCollectionsAction } from './actions/DeleteObjectsAction';
import { ExportPropertiesAction } from './actions/ExportPropertiesAction';
import { RemoveFromCollectionAction } from './actions/RemoveFromCollectionAction';
import { ObjectsActionContext } from './ObjectsActionContextClass';
import { ObjectsActionContextReact, useObjectsActionContext } from './ObjectsActionHooks';
import type { ObjectsActionSpec } from './ObjectsActionSpec';

const DEFAULT_ACTIONS: ObjectsActionSpec[] = [
    ExportPropertiesAction,
    ChangeTypeAction,
    AddToCollectionAction,
    DeleteObjectsAction,
    RemoveFromCollectionAction,
    DeleteObjectsFromCollectionsAction,
];

interface ObjectsActionContextProps {
    children: ReactNode;
    type?: ContentObjectTypeItem;
}
export function ObjectsActionContextProvider({ children, type }: ObjectsActionContextProps) {
    const selection = useDocumentSelection();
    const toast = useToast();
    const { client } = useUserSession();
    const search = useDocumentSearch();

    const context = useMemo(() => {
        const context = new ObjectsActionContext({
            selection,
            toast,
            client,
            search,
            type,
        });
        context.allActions = DEFAULT_ACTIONS;
        return context;
    }, [client, search, selection, toast, type]);

    return (
        context && (
            <ObjectsActionContextReact.Provider value={context}>
                <Actions />
                {children}
            </ObjectsActionContextReact.Provider>
        )
    );
}

function Actions() {
    const context = useObjectsActionContext();

    const selection = context.params.selection;
    const objectId = selection.getObjectId();
    const objectIds = selection.isSingleSelection() && objectId ? [objectId] : selection.getObjectIds();

    return (
        <div style={{ display: 'none' }}>
            {context.allActions.map((action) => (
                <action.component
                    key={action.id}
                    action={action}
                    objectIds={objectIds}
                    collectionId={selection.collectionId}
                />
            ))}
        </div>
    );
}
