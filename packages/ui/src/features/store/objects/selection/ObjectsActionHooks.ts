import { createContext, useContext, useEffect } from 'react';
import { ObjectsActionContext, type ObjectsActionCallback } from './ObjectsActionContextClass';

export { type ObjectsActionCallback };

export const ObjectsActionContextReact = createContext<ObjectsActionContext>(undefined as any);

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
