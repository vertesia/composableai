import { ReactNode, useMemo } from 'react';

import { ErrorBox, useFetch, useToast } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';

import { useDocumentSearch } from '../search/DocumentSearchContext';
import { useDocumentSelection } from '../DocumentSelectionProvider';
import { AddToCollectionAction } from './actions/AddToCollectionAction';
import { ChangeTypeAction } from './actions/ChangeTypeAction';
import { DeleteObjectsAction, DeleteObjectsFromCollectionsAction } from './actions/DeleteObjectsAction';
import { ExportPropertiesAction } from './actions/ExportPropertiesAction';
import { RemoveFromCollectionAction } from './actions/RemoveFromCollectionAction';
import { StartWorkflowAction, StartWorkflowComponent } from './actions/StartWorkflowComponent';
import { ObjectsActionSpec } from './ObjectsActionSpec';
import { ObjectsActionContext } from './ObjectsActionContextClass';
import { ObjectsActionContextReact, useObjectsActionContext } from './ObjectsActionHooks';

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
}
export function ObjectsActionContextProvider({ children }: ObjectsActionContextProps) {
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
            selection, toast, client, search
        });
        context.allActions = DEFAULT_ACTIONS;
        context.wfRules = rules!;
        return context;
    }, [selection, rules]);

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
