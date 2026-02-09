
import type { JSONSchemaObject } from "@vertesia/common";
import { Button, FormItem } from "@vertesia/ui/core";
import clsx from "clsx";
import { Plus, Trash2 } from "lucide-react";
import { ComponentType, ReactNode, SyntheticEvent, useState } from "react";
import { FormContext, FormContextProvider, InputComponentProps, useForm } from "./FormContext.js";
import { ManagedListProperty, ManagedObject, ManagedObjectBase, ManagedProperty, Node } from "./ManagedObject.js";
import { Input } from "./inputs.js";
import { EnumInput, EnumArrayInput } from "./EnumInput.js";

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
        onSubmit && onSubmit(object.value);
    }
    object.observer = onChange;
    return (
        <FormContextProvider value={new FormContext(object, components || {}, disabled ?? false)}>
            <form className="w-full" onSubmit={_onSubmit}>
                {children}
            </form>
        </FormContextProvider >
    )
}

function GeneratedFormFields() {
    const ctx = useForm();
    return (
        <div className='flex flex-col gap-4 w-full'>
            {
                ctx.object.properties.map(renderProperty)
            }
        </div>
    )
}

export function GeneratedForm({ children, ...props }: FormProps) {
    return (
        <Form {...props}>
            <GeneratedFormFields />
            {children}
        </Form>
    )
}

function renderProperty(prop: Node) {
    if (prop.isList) {
        return <ListField key={prop.name} object={prop as ManagedListProperty} />
    } else if (prop.isObject) {
        return <CompositeField key={prop.name} object={prop as ManagedObjectBase} />
    } else {
        return <ScalarField key={prop.name} object={prop as ManagedProperty} />
    }
}

function renderItemProperty(prop: Node, editor?: string) {
    if (prop.isList) {
        return <ListField object={prop as ManagedListProperty} />
    } else if (prop.isObject) {
        return <CompositeField object={prop as ManagedObjectBase} />
    } else {
        return <ScalarField object={prop as ManagedProperty} editor={editor} />
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
    const inputType = object.getInputType();

    let Component;
    if (inputType === 'enum') {
        Component = object.schema.isMulti ? EnumArrayInput : EnumInput;
    } else {
        Component = (editor && components[editor]) || Input;
    }

    if (inputType === 'checkbox') {
        inline = true;
    }

    const handleOnChange = (event: any) => {
        if (disabled) return;
        if (object.schema.isBoolean) {
            object.value = event.target.checked;
        } else if (object.schema.isNumber) {
            object.value = parseFloat(event.target.value);
        } else {
            object.value = event.target.value;
        }
    }

    if (object.isListItem) {
        // List items don't need the FormItem wrapper (no label, description, etc.)
        return <Component object={object} type={inputType} onChange={handleOnChange} disabled={disabled} />;
    }

    return (
        <FormItem label={object.title} required={object.schema.isRequired} description={object.schema.description}
            className={clsx('flex', inline ? 'flex-row items-center' : 'flex-col')}>
            <Component object={object} type={inputType} onChange={handleOnChange} disabled={disabled} />
        </FormItem>
    )
}

interface ObjectFormProps {
    object: ManagedObjectBase;
}
function CompositeField({ object }: ObjectFormProps) {
    return (
        <div className="flex flex-col gap-4 my-4 py-2 pl-4 border-l-4 border-l-solid border-l-slate-100 dark:border-l-slate-600">
            {!object.isListItem && <div className='text-gray-900 dark:text-gray-200 font-semibold'>{object.title}</div>}
            {
                object.properties.map(renderProperty)
            }
        </div>
    )
}

interface ListFieldProps {
    object: ManagedListProperty;
}
function ListField({ object }: ListFieldProps) {
    const [value, setValue] = useState<any[]>(object.value || []);
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
        <div className="flex flex-col gap-4 my-4 py-2 pl-4 border-l-4 border-l-solid border-l-slate-100 darK:border-l-slate-600">
            {!object.isListItem && <div className='text-gray-900 dark:text-gray-200 font-semibold'>{object.title}</div>}
            {
                object.items.map((item, index) => {
                    return <ListItem key={`${index}-${value[index] ?? ''}`} object={item} list={object} onDelete={() => deleteItem(index)} disabled={disabled} />;
                })
            }
            <div>
                <Button variant='secondary' onClick={addItem} disabled={disabled}><Plus className="size-6" /> Add</Button>
            </div>
        </div>
    )
}

interface ListItemProps {
    list: ManagedListProperty;
    object: Node & { index: number };
    onDelete: () => void;
    disabled?: boolean;
}
function ListItem({ list, object, onDelete, disabled }: ListItemProps) {
    return (
        <div className='flex gap-2 w-full'>
            <div className="flex-1">
                {
                    renderItemProperty(object, list.schema.arraySchema.editor)
                }
            </div>
            <Button variant='secondary' onClick={onDelete} disabled={disabled}><Trash2 className='size-4' /></Button>
        </div>
    )
}
