import { Button, errorMessage, Switch, useToast } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import type { ManagedSchema, SchemaNode } from '../ManagedSchema.js';
import { TypeNames } from '../type-signature.js';
import { Editable } from './Editable.js';
import { type EditableSchemaProperty, getEditableSchemaProperty } from './EditableSchemaProperty.js';
import { PropertyEditor } from './PropertyEditor.js';
import { PropertyViewer } from './PropertyViewer.js';

// do not exit edit mode when user is clicking inside the type suggestion popup
function skipClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    return !!target.closest?.('.schema-type-suggest-popup');
}

interface SchemaTreeProps {
    schema: ManagedSchema;
    readonly?: boolean;
}
export function SchemaEditor({ schema, readonly = false }: SchemaTreeProps) {
    const { t } = useUITranslation();
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground border-b border-border">
                <div className="flex-1 min-w-0">{t('widgets.schema.propertyColumn')}</div>
                {!readonly && (
                    <div className="shrink-0 w-28 text-end pe-1" title={t('widgets.schema.extractFromDocumentHint')}>
                        {t('widgets.schema.extractFromDocument')}
                    </div>
                )}
                {/* space for expand/collapse on parent rows */}
                <div className="w-8 shrink-0" />
            </div>
            <ul className="">
                {schema.children.map((prop) => {
                    return renderProperty(prop, readonly);
                })}
                {!readonly ? <AddPropertyButton parent={schema.root} /> : null}
            </ul>
        </div>
    );
}

function renderProperty(node: SchemaNode, readonly: boolean) {
    return node.isParent ? (
        <ParentItem key={node.name} property={node} readonly={readonly} />
    ) : (
        <SimpleItem key={node.name} node={node} readonly={readonly} />
    );
}

interface SimpleItemProps {
    node: SchemaNode;
    readonly: boolean;
}
function SimpleItem({ node, readonly }: SimpleItemProps) {
    return (
        <li className="border-b border-border/40 last:border-0">
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
        <li className="border-b border-border/40 last:border-0">
            <div className="flex items-center w-full gap-1">
                <div className="flex-1 min-w-0">
                    <PropertyTitleBar property={property} readonly={readonly} />
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setOpen(!isOpen)}
                    aria-label={isOpen ? `Collapse ${property.name}` : `Expand ${property.name}`}
                    aria-expanded={isOpen}
                    className="shrink-0"
                >
                    <Icon className="size-4 cn-rtl-flip" />
                </Button>
            </div>
            {isOpen && (
                <ul className="ms-4 border-s border-gray-400 border-dashed">
                    {(property.children || []).map((prop) => renderProperty(prop, readonly))}
                    {!readonly ? <AddPropertyButton parent={property} /> : null}
                </ul>
            )}
        </li>
    );
}

export function validatePropertyName(propertyName: string): string | undefined {
    if (!propertyName) {
        return 'Name is required';
    }
    if (/^[a-zA-Z0-9_]+[?]?$/.test(propertyName)) {
        return undefined; // valid
    }
    return 'Only letters, numbers, underscores or question mark are allowed (a-zA-Z0-9_?)';
}

interface PropertyTitleBarProps {
    property: SchemaNode;
    readonly: boolean;
}
function PropertyTitleBar({ property, readonly }: PropertyTitleBarProps) {
    const { t } = useUITranslation();
    const toast = useToast();

    const onChange = (value: EditableSchemaProperty) => {
        try {
            if (value.description && typeof value.description !== 'string') {
                value.description = undefined;
            }

            const update = property.getUpdateFromNameAndTypeSignature(value.name, value.type);

            if (
                property.update({
                    ...update,
                    description: value.description,
                    extractable: value.extractable,
                })
            ) {
                property.reloadTree();
            }
        } catch (err: unknown) {
            toast({
                status: 'error',
                title: t('widgets.schema.invalidPropertyDeclaration'),
                description: errorMessage(err),
                duration: 9000,
            });
            return false;
        }
        return true;
    };

    /** Toggle extractability without entering name/type edit mode. */
    const onExtractableChange = (extractable: boolean) => {
        if (property.update({ extractable })) {
            property.reloadTree();
        }
    };

    const isNew = property.resetIsNew();
    const editableProp = getEditableSchemaProperty(property);

    return (
        <div className="flex items-center gap-2 w-full min-w-0 py-0.5">
            <div className="flex-1 min-w-0">
                <Editable
                    value={editableProp}
                    onChange={onChange}
                    onDelete={() => {
                        property.remove();
                        property.reloadTree();
                    }}
                    editor={PropertyEditor}
                    viewer={PropertyViewer}
                    outlineOnHover
                    isEditing={isNew}
                    skipClickOutside={skipClickOutside}
                    readonly={readonly}
                    onValidate={(prop) => validatePropertyName(prop.name)}
                />
            </div>
            {!readonly ? (
                <div className="shrink-0 w-28 flex items-center justify-end gap-1.5 pe-1">
                    <Switch
                        size="sm"
                        value={property.extractable}
                        onChange={onExtractableChange}
                        aria-label={`${t('widgets.schema.extractFromDocument')}: ${property.name}`}
                    />
                </div>
            ) : property.extractable === false ? (
                <div className="shrink-0 w-28 flex justify-end pe-1">
                    <span
                        className="text-[10px] uppercase tracking-wide text-attention border border-attention/40 bg-attention/10 rounded px-1.5 py-0.5"
                        title={t('widgets.schema.extractFromDocumentHint')}
                    >
                        {t('widgets.schema.noExtract')}
                    </span>
                </div>
            ) : null}
        </div>
    );
}

interface AddPropertyButtonProps {
    parent: SchemaNode;
}
function AddPropertyButton({ parent }: AddPropertyButtonProps) {
    const add = () => {
        const name = parent.findAvailableChildName('new_property_');
        const child = parent.addChild(
            name,
            { isObject: false, isArray: false, isNullable: false, name: TypeNames.string },
            true,
        );
        child.isNew = true;
        parent.reloadTree();
    };
    return (
        <Button variant="ghost" onClick={add}>
            <Plus className="size-4" />
            Add property
        </Button>
    );
}
