import { ComponentType, createContext, useContext } from "react";
import { ManagedObject, ManagedObjectBase, Node } from "./ManagedObject.js";

const FieldSetContext = createContext<ManagedObjectBase | undefined>(undefined);
const FieldSetContextProvider = FieldSetContext.Provider;

export function useFieldSet() {
    const ctx = useContext(FieldSetContext);
    if (!ctx) {
        throw new Error('useFieldSet must be used within a Form or FieldSet element');
    }
    return ctx;
}

export interface InputComponentProps {
    object: Node;
    type: string; // the editor/input type
    onChange?: (event: any) => void;
    disabled?: boolean;
}
export class FormContext {
    constructor(public object: ManagedObject,
        public components: Record<string, ComponentType<InputComponentProps>> = {},
        public disabled: boolean = false) {
    }

}

const _FormContext = createContext<FormContext | undefined>(undefined);

export function useForm() {
    const ctx = useContext(_FormContext);
    if (!ctx) {
        throw new Error('useForm must be used within a Form element');
    }
    return ctx;
}

const FormContextProvider = _FormContext.Provider;

export { FieldSetContextProvider, FormContextProvider };
