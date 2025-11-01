
import { Plus, Trash2 } from "lucide-react";
import { Button, FormItem } from "@vertesia/ui/core";
import clsx from "clsx";
import type { JSONSchemaObject } from "@vertesia/common";
import { ComponentType, ReactNode, SyntheticEvent, useState } from "react";
import { FormContextProvider, InputComponentProps, useForm } from "./FormContext.js";
import { ManagedListProperty, ManagedObject, ManagedObjectBase, ManagedProperty, Node } from "./ManagedObject.js";
import { Input } from "./inputs.js";

interface FormProps {
    object: ManagedObject;
    components?: Record<string, ComponentType<InputComponentProps>>;
    children?: ReactNode | ReactNode[];
    onSubmit?: (data: JSONSchemaObject) => void;
    onChange?: (prop: Node) => void;
}
export function Form({ object, components, onSubmit, children, onChange }: FormProps) {
    const _onSubmit = (evt: SyntheticEvent) => {
        evt.stopPropagation();
        evt.preventDefault();
        onSubmit && onSubmit(object.value);
    }
    object.observer = onChange;
    return (
        <FormContextProvider value={{
            object,
            components: components || {}
        }}>
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
    const { components } = useForm();
    const Component = (editor && components[editor]) || Input;
    const inputType = object.getInputType();
    if (inputType === 'checkbox') {
        inline = true;
    }

    const handleOnChange = (event: any) => {
        const { value } = event.target;
        object.value = object.schema.isNumber ? parseFloat(value) : value
    }

    return (
        <FormItem label={object.title} required={object.schema.isRequired} description={object.schema.description}
            className={clsx('flex', inline ? 'flex-row items-center' : 'flex-col')}>
            <Component object={object} type={inputType} onChange={handleOnChange} />
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

    const addItem = () => {
        object.add();
        setValue([...object.value]);
    };

    const deleteItem = (index: number) => {
        object.remove(index);
        setValue([...object.value]);
    };

    return (
        <div className="flex flex-col gap-4 my-4 py-2 pl-4 border-l-4 border-l-solid border-l-slate-100 darK:border-l-slate-600">
            {!object.isListItem && <div className='text-gray-900 dark:text-gray-200 font-semibold'>{object.title}</div>}
            {
                object.items.map((item, index) => {
                    return <ListItem key={`${index}-${value[index] ?? ''}`} object={item} list={object} onDelete={() => deleteItem(index)} />;
                })
            }
            <div>
                <Button variant='secondary' onClick={addItem}><Plus className="size-6" /> Add</Button>
            </div>
        </div>
    )
}

interface ListItemProps {
    list: ManagedListProperty;
    object: Node & { index: number };
    onDelete: () => void;
}
function ListItem({ list, object, onDelete }: ListItemProps) {
    return (
        <div className='flex gap-2 w-full'>
            <div className="flex-1">
                {
                    renderItemProperty(object, list.schema.arraySchema.editor)
                }
            </div>
            <Button variant='secondary' onClick={onDelete}><Trash2 className='size-4' /></Button>
        </div>
    )
}
