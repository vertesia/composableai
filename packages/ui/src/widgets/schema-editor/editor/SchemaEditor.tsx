import { useState } from 'react';

import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { Button, useToast } from '@vertesia/ui/core';

import { ManagedSchema, SchemaNode } from '../ManagedSchema.js';
import { TypeNames } from '../type-signature.js';
import { Editable } from './Editable.js';
import { EditableSchemaProperty, getEditableSchemaProperty } from './EditableSchemaProperty.js';
import { PropertyEditor } from './PropertyEditor.js';
import { PropertyViewer } from './PropertyViewer.js';

// do not exit edit mode when user is clicking inside the type suggestion popup
function skipClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    return !!(target.closest && target.closest('.schema-type-suggest-popup'));
};

interface SchemaTreeProps {
    schema: ManagedSchema;
    readonly?: boolean;
}
export function SchemaEditor({ schema, readonly = false }: SchemaTreeProps) {
    return (
        <ul className="">
            {
                schema.children.map(prop => {
                    return renderProperty(prop, readonly)
                })
            }
            {
                !readonly ? <AddPropertyButton parent={schema.root} /> : null
            }
        </ul>
    );
}

function renderProperty(node: SchemaNode, readonly: boolean) {
    return (
        node.isParent ?
            <ParentItem key={node.name} property={node} readonly={readonly} />
            :
            <SimpleItem key={node.name} node={node} readonly={readonly} />
    );
}

interface SimpleItemProps {
    node: SchemaNode;
    readonly: boolean
}
function SimpleItem({ node, readonly }: SimpleItemProps) {
    return (
        <li>
            <PropertyTitleBar property={node} readonly={readonly} />
        </li>
    );
}

interface ParentItemProps {
    property: SchemaNode;
    readonly: boolean;
}
function ParentItem({ property, readonly }: ParentItemProps) {
    const [isOpen, setOpen] = useState(true);
    const Icon = isOpen ? ChevronDown : ChevronRight;

    return (
        <li>
            <div className='flex items-center w-full'>
                <button onClick={() => setOpen(!isOpen)}><Icon className="size-4" /></button>
                <div className='flex-1'><PropertyTitleBar property={property} readonly={readonly} /></div>
            </div>
            {
                isOpen &&
                <ul className="ml-4 border-l border-gray-400 border-dashed">
                    {
                        (property.children || []).map(prop => renderProperty(prop, readonly))
                    }
                    {
                        !readonly ? <AddPropertyButton parent={property} /> : null
                    }
                </ul>
            }
        </li>
    );
}

export function validatePropertyName(propertyName: string): string | undefined {
    if (!propertyName) {
        return 'Name is required';
    }
    if (/^[a-zA-Z0-9_]+[?]?$/.test(propertyName)) {
        return undefined;  // valid
    }
    return 'Only letters, numbers, underscores or question mark are allowed (a-zA-Z0-9_?)';
}

interface PropertyTitleBarProps {
    property: SchemaNode;
    readonly: boolean;
}
function PropertyTitleBar({ property, readonly }: PropertyTitleBarProps) {
    const toast = useToast();

    const onChange = (value: EditableSchemaProperty) => {
        try {
            if (value.description && typeof value.description !== 'string') {
                value.description = undefined;
            }

            const update = property.getUpdateFromNameAndTypeSignature(value.name, value.type);

            // Pass enum values if present
            if (value.enumValues !== undefined) {
                update.enumValues = value.enumValues;
            }

            if (property.update({ ...update, description: value.description })) {
                property.reloadTree();
            }
        } catch (err: any) {
            toast({
                status: 'error',
                title: 'Invalid property declaration',
                description: err.message,
                duration: 9000
            })
            return false;
        }
        return true;
    }
    const isNew = property.resetIsNew();
    const editableProp = getEditableSchemaProperty(property);

    return (
        <Editable value={editableProp} onChange={onChange}
            onDelete={() => {
                property.remove()
                property.reloadTree();
            }}
            editor={PropertyEditor}
            viewer={PropertyViewer}
            outlineOnHover isEditing={isNew}
            skipClickOutside={skipClickOutside}
            readonly={readonly}
            onValidate={(property) => validatePropertyName(property.name)}
        />
    );
}

interface AddPropertyButtonProps {
    parent: SchemaNode;
}
function AddPropertyButton({ parent }: AddPropertyButtonProps) {
    const add = () => {
        const name = parent.findAvailableChildName("new_property_");
        const child = parent.addChild(name, { isObject: false, isArray: false, isNullable: false, name: TypeNames.string }, true);
        child.isNew = true;
        parent.reloadTree();
    }
    return (
        <Button variant="ghost" onClick={add}>
            <Plus className='size-4' />Add property
        </Button>
    )
}
