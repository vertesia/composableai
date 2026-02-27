import React, { ChangeEvent, useEffect, useRef, useState } from 'react';

import { AlignLeft, Settings2 } from 'lucide-react';
import { Button, Modal, ModalBody, ModalFooter, ModalTitle, Styles, SelectBox } from '@vertesia/ui/core';

import { TypeNames } from '../type-signature.js';
import { DataEditorProps } from './Editable.js';
import { EditableSchemaProperty } from './EditableSchemaProperty.js';
import { EnumValuesDialog } from './EnumValuesDialog.js';

function makeTypeOptions() {
    const types: string[] = Object.values(TypeNames)
    const options = [...types]
    for (const type of types) {
        options.push(type + '[]');
    }
    types.sort();
    return options;
}

const TYPE_OPTIONS = makeTypeOptions();

export function PropertyEditor({ value, onChange, onCancel, onSave }: DataEditorProps<EditableSchemaProperty>) {
    const [isModalOpen, setModalOpen] = useState(false);
    const [isEnumModalOpen, setEnumModalOpen] = useState(false);

    if (!value) return null;

    const onNameChange = (text: string) => {
        onChange({ ...value, name: text })
    }

    const onTypeChange = (text: string) => {
        onChange({ ...value, type: text })
    }

    const onDescriptionChange = (text?: string) => {
        if (text !== undefined && typeof text === 'string') {
            onChange({ ...value, description: text }, true);
        }
        setModalOpen(false);
    }

    const onEnumValuesChange = (values: string[]) => {
        onChange({ ...value, enumValues: values }, true);
    }

    const isEnumType = value.type === 'enum' || value.type === 'enum[]';

    return (
        <div className="flex items-center">
            <div className="flex-1">
                <PropertyNameEditor value={value.name} onChange={onNameChange} onCancel={onCancel} onSave={onSave} />
            </div>
            <div className="px-1 font-semibold">:</div>
            <div className="flex-1">
                <PropertyTypeEditor value={value.type} onChange={onTypeChange} onCancel={onCancel} onSave={onSave} />
            </div>
            {isEnumType && (
                <div>
                    <Button variant="ghost" size="xs" onClick={() => setEnumModalOpen(true)} title="Edit enum values">
                        <Settings2 className="size-4" />
                    </Button>
                    <EnumValuesDialog
                        isOpen={isEnumModalOpen}
                        values={value.enumValues || []}
                        onClose={() => setEnumModalOpen(false)}
                        onSave={onEnumValuesChange}
                    />
                </div>
            )}
            <div>
                <Button variant={"ghost"} size={"xs"} onClick={() => setModalOpen(true)}  title="Edit description">
                    <AlignLeft className="size-4" />
                </Button>
                <EditDescriptionModal value={value.description} isOpen={isModalOpen} onClose={onDescriptionChange} />
            </div>
        </div>
    )

}


export function PropertyNameEditor({ value, onChange, onCancel, onSave }: DataEditorProps<string>) {
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => {
        ref.current?.focus();
    }, [])

    const onKeyUp = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case "Enter":
                onSave?.();
                break;
            case "Escape":
                onCancel?.();
                break;
        }
    }

    const _onChange = (e: ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    }

    return (
        <input onKeyUp={onKeyUp} ref={ref} value={value} onChange={_onChange} className={Styles.INPUT_UNSTYLED} style={{ fontSize: "inherit", width: "", display: "inline" }} />
    )
}

function PropertyTypeEditor({ value, onChange, onCancel, onSave }: DataEditorProps<string>) {
    const onBlur = () => {
        onSave?.();
    }
    const onKeyDown = (e: React.KeyboardEvent<Element>, isOpen: boolean) => {
        if (!isOpen) {
            if (e.key === 'Enter') {
                onSave?.();
            } else if (e.key === 'Escape') {
                onCancel?.();
            }
        }
    }
    return (
        <SelectBox 
            className={Styles.INPUT_UNSTYLED}
            options={TYPE_OPTIONS}
            value={value || ''}
            onBlur={onBlur}
            onChange={onChange}
            onKeyDown={onKeyDown}
            popupClass="schema-type-suggest-popup z-90"
        />
    )
}

interface EditDescriptionModalProps {
    value: string | undefined;
    isOpen: boolean;
    onClose: (text?: string) => void;
}
function EditDescriptionModal({ value, isOpen, onClose }: EditDescriptionModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <ModalTitle>Edit description</ModalTitle>
            <EditDescriptionModalForm value={value} onSave={onClose} />
        </Modal>
    )
}

interface EditDescriptionModalFormProps {
    value: string | undefined;
    onSave: (text: string) => void;
}
function EditDescriptionModalForm({ value, onSave }: EditDescriptionModalFormProps) {
    const ref = useRef<HTMLTextAreaElement>(null);
    const [currentValue, setCurrentValue] = useState(value || '');
    useEffect(() => {
        ref.current && ref.current.focus();
    }, [ref.current]);
    return (
        <>
            <ModalBody className="h-max">
                <textarea ref={ref} className="dark:bg-gray-800 w-full h-full dark:text-white" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
            </ModalBody>
            <ModalFooter>
                <Button onClick={() => onSave(currentValue)}>Save Changes</Button>
            </ModalFooter>
        </>
    )
}
