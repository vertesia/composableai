import type { JSONSchemaObject } from '@vertesia/common';
import { Button, FormItem } from '@vertesia/ui/core';
import clsx from 'clsx';
import { Plus, Trash2 } from 'lucide-react';
import { type ComponentType, type ReactNode, type SyntheticEvent, useState } from 'react';
import {
    FormContext,
    FormContextProvider,
    type InputChangeEvent,
    type InputComponentProps,
    useForm,
} from './FormContext.js';
import type { ManagedListProperty, ManagedObject, ManagedObjectBase, ManagedProperty, Node } from './ManagedObject.js';
import { Input } from './inputs.js';

interface FormProps {
    object: ManagedObject;
    components?: Record<string, ComponentType<InputComponentProps>>;
    children?: ReactNode | ReactNode[];
    onSubmit?: (data: JSONSchemaObject) => void;
    onChange?: (prop: Node) => void;
    disabled?: boolean;
}
export function Form({ object, components, onSubmit, children, onChange, disabled }: FormProps) {
    const _onSubmit = (evt: SyntheticEvent) => {
        evt.stopPropagation();
        evt.preventDefault();
        onSubmit?.(object.value);
    };
    object.observer = onChange;
    return (
        <FormContextProvider value={new FormContext(object, components || {}, disabled ?? false)}>
            <form className="w-full" onSubmit={_onSubmit}>
                {children}
            </form>
        </FormContextProvider>
    );
}

function GeneratedFormFields() {
    const ctx = useForm();
    return <div className="flex flex-col gap-4 w-full">{ctx.object.properties.map(renderProperty)}</div>;
}

export function GeneratedForm({ children, ...props }: FormProps) {
    return (
        <Form {...props}>
            <GeneratedFormFields />
            {children}
        </Form>
    );
}

function renderProperty(prop: Node) {
    if (prop.isList) {
        return <ListField key={prop.name} object={prop as ManagedListProperty} />;
    } else if (prop.isObject) {
        return <CompositeField key={prop.name} object={prop as ManagedObjectBase} />;
    } else {
        return <ScalarField key={prop.name} object={prop as ManagedProperty} />;
    }
}

function renderItemProperty(prop: Node, editor?: string) {
    if (prop.isList) {
        return <ListField object={prop as ManagedListProperty} />;
    } else if (prop.isObject) {
        return <CompositeField object={prop as ManagedObjectBase} />;
    } else {
        return <ScalarField object={prop as ManagedProperty} editor={editor} />;
    }
}

interface ScalarFieldProps {
    object: ManagedProperty;
    inline?: boolean;
    editor?: string; // if present overwrite the object schema editor
}
export function ScalarField({ object, editor, inline = false }: ScalarFieldProps) {
    if (!editor) {
        editor = object.schema.editor;
    }
    const { components, disabled } = useForm();
    const Component = (editor && components[editor]) || Input;
    const inputType = object.getInputType();
    if (inputType === 'checkbox') {
        inline = true;
    }

    const handleOnChange = (event: InputChangeEvent) => {
        if (disabled) return;
        if (object.schema.isBoolean) {
            object.value = event.target instanceof HTMLInputElement ? event.target.checked : false;
        } else if (object.schema.isNumber) {
            object.value = parseFloat(event.target.value);
        } else {
            object.value = event.target.value;
        }
    };

    if (object.isListItem) {
        // List items don't need the FormItem wrapper (no label, description, etc.)
        return <Component object={object} type={inputType} onChange={handleOnChange} disabled={disabled} />;
    }

    return (
        <FormItem
            label={object.title}
            required={object.schema.isRequired}
            description={object.schema.description}
            className={clsx('flex', inline ? 'flex-row items-center' : 'flex-col')}
        >
            <Component object={object} type={inputType} onChange={handleOnChange} disabled={disabled} />
        </FormItem>
    );
}

interface ObjectFormProps {
    object: ManagedObjectBase;
}
function CompositeField({ object }: ObjectFormProps) {
    return (
        <div className="flex flex-col gap-4 my-4 py-2 ps-4 border-s-4 border-s-solid border-s-slate-100 dark:border-s-slate-600">
            {!object.isListItem && <div className="text-gray-900 dark:text-gray-200 font-semibold">{object.title}</div>}
            {object.properties.map(renderProperty)}
        </div>
    );
}

interface ListFieldProps {
    object: ManagedListProperty;
}
function ListField({ object }: ListFieldProps) {
    const [, setValue] = useState<unknown[]>(object.value || []);
    const { disabled } = useForm();

    const addItem = () => {
        if (disabled) return;
        object.add();
        setValue([...object.value]);
    };

    const deleteItem = (index: number) => {
        if (disabled) return;
        object.remove(index);
        setValue([...object.value]);
    };

    return (
        <div className="flex flex-col gap-4 my-4 py-2 ps-4 border-s-4 border-s-solid border-s-slate-100 darK:border-s-slate-600">
            {!object.isListItem && <div className="text-gray-900 dark:text-gray-200 font-semibold">{object.title}</div>}
            {object.items.map((item, index) => {
                return (
                    <ListItem
                        key={item.key}
                        object={item}
                        list={object}
                        onDelete={() => deleteItem(index)}
                        disabled={disabled}
                    />
                );
            })}
            <div>
                <Button variant="outline" onClick={addItem} disabled={disabled}>
                    <Plus className="size-6" /> Add
                </Button>
            </div>
        </div>
    );
}

interface ListItemProps {
    list: ManagedListProperty;
    object: Node & { index: number; key: string };
    onDelete: () => void;
    disabled?: boolean;
}
function ListItem({ list, object, onDelete, disabled }: ListItemProps) {
    const editor = typeof list.schema.arraySchema.editor === 'string' ? list.schema.arraySchema.editor : undefined;
    return (
        <div className="flex gap-2 w-full">
            <div className="flex-1">{renderItemProperty(object, editor)}</div>
            <Button variant="ghost" onClick={onDelete} disabled={disabled} alt="Delete">
                <Trash2 className="size-4 text-destructive" />
            </Button>
        </div>
    );
}
