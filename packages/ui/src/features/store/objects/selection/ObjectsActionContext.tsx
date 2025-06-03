import { createContext, ReactNode, useContext, useEffect, useMemo } from 'react';

import { useUserSession } from '@vertesia/ui/session';
import { ErrorBox, useToast } from '@vertesia/ui/core';
import { useFetch } from '@vertesia/ui/core';

import { useDocumentSelection, useDocumentSearch } from '@vertesia/ui/features';
import { AddToCollectionAction } from './actions/AddToCollectionAction';
import { ChangeTypeAction } from './actions/ChangeTypeAction';
import { DeleteObjectsAction } from './actions/DeleteObjectsAction';
import { ExportPropertiesAction } from './actions/ExportPropertiesAction';
import { RemoveFromCollectionAction } from './actions/RemoveFromCollectionAction';
import { StartWorkflowAction, StartWorkflowComponent } from './actions/StartWorkflowComponent';
import { ObjectsActionParams, ObjectsActionSpec } from './ObjectsActionSpec';

export type ObjectsActionCallback = (params: ObjectsActionParams) => Promise<unknown>;

export class ObjectsActionContext {
    allActions: ObjectsActionSpec[] = [
        ExportPropertiesAction,
        ChangeTypeAction,
        StartWorkflowAction,
        AddToCollectionAction,
        DeleteObjectsAction,
        RemoveFromCollectionAction,
    ];
    wfRules: ObjectsActionSpec[] = [];
    callbacks: Record<string, ObjectsActionCallback> = {};
    startWorkflow?: ObjectsActionCallback;

    constructor(public params: Omit<ObjectsActionParams, 'action'>) { }

    get actions(): ObjectsActionSpec[] {
        const isInCollection = !!this.params.selection?.collectionId;

        if (isInCollection) {
            return this.allActions.filter(action =>
                action.id !== 'addToCollection' && action.id !== 'delete'
            );
        } else {
            return this.allActions.filter(action =>
                action.id !== 'removeFromCollection'
            );
        }
    }

    async loadWorkflows() {
        this.params.client.workflows.rules.list().then((rules) => {
            this.wfRules = rules.map(rule => (
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
        return this.wfRules;
    }

    registerCallback(name: string, cb: (params: ObjectsActionParams) => Promise<unknown>) {
        this.callbacks[name] = cb;
        return () => {
            delete this.callbacks[name];
        }
    }

    unregisterCallback(name: string) {
        delete this.callbacks[name];
    }

    findAction(actionId: string) {
        let action = this.allActions.find(a => a.id === actionId);
        if (!action) {
            action = this.wfRules.find(a => a.id === actionId);
        }
        return action;
    }

    async run(actionId: string): Promise<unknown> {
        const action = this.findAction(actionId);
        if (!action) {
            throw new Error(`Action ${actionId} not found`);
        }
        const params = { ...this.params, action };
        // if (action.isWorkflow) {
        //     if (!this.startWorkflow) {
        //         throw new Error("No startWorkflow callback set");
        //     }
        //     return this.startWorkflow(params);
        // } else {
        const cb = this.callbacks[actionId];
        if (cb) {
            return cb(params);
        } else {
            throw new Error("No action callback set");
        }
        //        }
    }
}

const ObjectsActionContextReact = createContext<ObjectsActionContext>(undefined as any);

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

interface ActionsProps {
}
function Actions({ }: ActionsProps) {
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

export function useObjectsActionContext() {
    const ctx = useContext(ObjectsActionContextReact);
    if (!ctx) {
        throw new Error("You cannot use useActionContext outside an ActionProvider");
    }
    return ctx;
}

export function useObjectsActionCallback(name: string, cb: ObjectsActionCallback) {
    const ctx = useObjectsActionContext();
    useEffect(() => {
        return ctx.registerCallback(name, cb);
    }, [ctx, name, cb]);
    return ctx;
}

export function useStartWorkflowCallback(cb: ObjectsActionCallback) {
    const ctx = useObjectsActionContext();
    useEffect(() => {
        ctx.startWorkflow = cb;
        return () => {
            ctx.startWorkflow = undefined;
        }
    }, [cb, ctx]);
    return ctx;
}
