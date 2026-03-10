import { ObjectsActionSpec, ObjectsActionParams } from './ObjectsActionSpec';

export type ObjectsActionCallback = (params: ObjectsActionParams) => Promise<unknown>;

export class ObjectsActionContext {
    allActions: ObjectsActionSpec[] = [];
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
                action.id !== 'removeFromCollection' && action.id !== 'deleteFromCollections'
            );
        }
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
        const cb = this.callbacks[actionId];
        if (cb) {
            return cb(params);
        } else {
            throw new Error("No action callback set");
        }
    }
}
