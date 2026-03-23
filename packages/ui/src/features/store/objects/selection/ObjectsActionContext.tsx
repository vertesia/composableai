import { ReactNode, useMemo } from 'react';

import { ColumnLayout } from '@vertesia/common';
import { ErrorBox, useFetch, useToast } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';

import { useDocumentSelection } from '../DocumentSelectionProvider';
import { useDocumentSearch } from '../search/DocumentSearchContext';
import { AddToCollectionAction } from './actions/AddToCollectionAction';
import { ChangeTypeAction } from './actions/ChangeTypeAction';
import { DeleteObjectsAction, DeleteObjectsFromCollectionsAction } from './actions/DeleteObjectsAction';
import { ExportPropertiesAction } from './actions/ExportPropertiesAction';
import { RemoveFromCollectionAction } from './actions/RemoveFromCollectionAction';
import { StartWorkflowAction, StartWorkflowComponent } from './actions/StartWorkflowComponent';
import { ObjectsActionContext } from './ObjectsActionContextClass';
import { ObjectsActionContextReact, useObjectsActionContext } from './ObjectsActionHooks';
import { ObjectsActionSpec } from './ObjectsActionSpec';

const DEFAULT_ACTIONS: ObjectsActionSpec[] = [
    ExportPropertiesAction,
    ChangeTypeAction,
    StartWorkflowAction,
    AddToCollectionAction,
    DeleteObjectsAction,
    RemoveFromCollectionAction,
    DeleteObjectsFromCollectionsAction,
];

interface ObjectsActionContextProps {
    children: ReactNode;
    table_layout?: ColumnLayout[];
}
export function ObjectsActionContextProvider({ children, table_layout }: ObjectsActionContextProps) {
    const selection = useDocumentSelection();
    const toast = useToast();
    const { client } = useUserSession();
    const search = useDocumentSearch();

    const { data: rules, error } = useFetch<ObjectsActionSpec[]>(() => {
        return client.workflows.rules.list().then((rules) => {
            return rules.map(rule => (
                {
                    id: rule.id,
                    name: rule.name,
                    description: rule.description,
                    confirm: false,
                    isWorkflow: true,
                    component: StartWorkflowComponent
                }
            )).sort((a, b) => a.name.localeCompare(b.name));
        });
    }, []);

    const context = useMemo(() => {
        const context = new ObjectsActionContext({
            selection, toast, client, search, table_layout
        });
        context.allActions = DEFAULT_ACTIONS;
        context.wfRules = rules!;
        return context;
    }, [selection, rules, table_layout]);

    if (error) {
        return <ErrorBox title="Failed to fetch workflows">{error.message}</ErrorBox>
    }

    return (
        context && (
            <ObjectsActionContextReact.Provider value={context}>
                <Actions />
                {children}
            </ObjectsActionContextReact.Provider>
        )
    )
}

function Actions() {
    const context = useObjectsActionContext();

    const selection = context.params.selection;
    const objectId = selection.getObjectId();
    const objectIds = selection.isSingleSelection() && objectId ? [objectId] : selection.getObjectIds();

    return (
        <div style={{ display: 'none' }}>
            {
                context.allActions.map(action => (
                    <action.component key={action.id} action={action} objectIds={objectIds} collectionId={selection.collectionId} />
                ))
            }
        </div>
    )
}
