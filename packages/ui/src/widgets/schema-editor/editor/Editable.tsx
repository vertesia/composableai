import clsx from 'clsx';
import { ChangeEvent, ComponentType, KeyboardEvent, useEffect, useRef, useState } from 'react';

import { Pencil, Trash2 } from 'lucide-react';
import { Styles, useClickOutside, useFlag } from '@vertesia/ui/core';

const VIEW_BOX = "block sm:text-sm sm:leading-6 rounded-md border-0 py-1.5 px-2 text-gray-900 dark:text-slate-50"
const VIEW_BOX_HOVER = `${VIEW_BOX} hover:shadow-xs hover:ring-1 hover:ring-inset hover:ring-gray-300 dark:hover:ring-slate-600`
const EDIT_BOX = `${VIEW_BOX} shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-slate-600`

export interface DataViewerProps<T> {
    value: T | undefined;
    placeholder?: string
}

export interface DataEditorProps<T> {
    value: T | undefined;
    onChange: (value: any, autoSave?: boolean) => void
    onSave?: () => void
    onCancel?: () => void
}

interface EditableProps<T> {
    value: T;
    viewer: ComponentType<DataViewerProps<T>>;
    editor: ComponentType<DataEditorProps<T>>;
    isEditing?: boolean;
    placeholder?: string;
    onChange: (value: T) => boolean;
    onDelete?: () => void;
    outlineOnHover?: boolean;
    editOnClick?: boolean;
    skipClickOutside?: (e: MouseEvent) => boolean;
    readonly?: boolean;
    /**
     * An optional validation function that returns an error message if the value is invalid.
     *
     * @returns An error message or undefined if the value is valid.
     */
    onValidate?: (value: T) => string | undefined;
}
export function Editable<T>({ value, onChange, onDelete,
    outlineOnHover = false,
    editOnClick = true,
    placeholder,
    viewer,
    editor,
    skipClickOutside,
    isEditing = false,
    readonly = false,
    onValidate,
}: EditableProps<T>) {
    const { on, off, isOn } = useFlag(isEditing);
    const [validationError, setValidationError] = useState<string | undefined>();

    const _onChange = (value?: any) => {
        if (onValidate) {
            const err = onValidate(value);
            if (err) {
                setValidationError(err);
                return; // don't save
            } else {
                setValidationError(undefined);
            }
        }

        if (onChange(value)) {
            off();
        }
    };

    const _skipClickOutside = (e: MouseEvent) => {
        if (skipClickOutside) {
            return skipClickOutside(e);
        }
        return false;
    };

    return (
        <div>
            {
                isOn && !readonly ?
                    <DataEdit
                        value={value}
                        onSave={_onChange}
                        onCancel={off}
                        editor={editor}
                        skipClickOutside={_skipClickOutside}
                    />
                    : <DataView value={value} onEdit={on} viewer={viewer}
                        placeholder={placeholder}
                        outlineOnHover={outlineOnHover}
                        editOnClick={editOnClick}
                        onDelete={onDelete}
                        readonly={readonly}
                    />
            }
            {
                validationError &&
                <div className="text-red-500 text-sm">{validationError}</div>
            }
        </div>
    )
}

interface DataViewProps<T> {
    value: T;
    viewer: ComponentType<DataViewerProps<T>>;
    onEdit: () => void;
    outlineOnHover?: boolean
    editOnClick?: boolean
    placeholder?: string
    onDelete?: () => void
    readonly?: boolean,
}
function DataView<T>({ viewer: Viewer, value, onEdit, editOnClick, outlineOnHover, placeholder, onDelete, readonly }: DataViewProps<T>) {
    const onClick = () => {
        editOnClick && onEdit();
    };

    const onKeyUp = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter") {
            onEdit();
        }
    };

    const btnStyle = 'hidden group-hover:block text-gray-400 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-400';

    return (
        <div tabIndex={0} onKeyUp={onKeyUp} onClick={onClick} className={clsx("flex justify-start items-center group", outlineOnHover ? VIEW_BOX_HOVER : VIEW_BOX, { 'cursor-pointer': editOnClick })}>
            <Viewer value={value} placeholder={placeholder} />
            <div className='ml-auto flex space-x-2'>
                {
                    !readonly && onDelete &&
                    <button className={btnStyle} onClick={onDelete}>
                        <Trash2 className="size-4" />
                    </button>
                }
                {
                    !readonly ?
                        <button className={btnStyle} onClick={onEdit}>
                            <Pencil className="size-4" />
                        </button>
                        : null
                }
            </div>
        </div>
    );
}

interface DataEditProps<T> {
    value: T;
    editor: ComponentType<DataEditorProps<T>>;
    onSave: (value: T) => void;
    onCancel: () => void;
    skipClickOutside?: (e: MouseEvent) => boolean;
}
function DataEdit<T>({ editor: Editor, value, onSave, onCancel, skipClickOutside }: DataEditProps<T>) {
    const [actualValue, setActualValue] = useState(value);
    const latestValue = useRef(value);
    const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

    const handleSave = () => {
        onSave(latestValue.current);
    };

    const ref = useClickOutside<HTMLDivElement>(handleSave, skipClickOutside);

    const _onChange = (value: any, autoSave = false) => {
        setActualValue(value);
        latestValue.current = value;
        if (autoSave) {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            setDebounceTimer(setTimeout(() => { onSave(value); }, 500))
        }
    };

    return (
        <div ref={ref}>
            <div className={EDIT_BOX}>
                <div className="w-full" onClick={(e) => e.stopPropagation()}>
                    <Editor
                        value={actualValue}
                        onChange={_onChange}
                        onSave={handleSave}
                        onCancel={onCancel}
                    />
                </div>
            </div>
        </div>
    );
}

export function TextDataViewer({ value, placeholder }: DataViewerProps<string>) {
    if (!value) {
        return (
            <span className='text-gray-400'>{placeholder || 'Missing value'}</span>
        );
    } else {
        return (
            <span>{value == null ? '' : value.toString()}</span>
        );
    }
}

export function TextDataEditor({ value, onChange, onCancel, onSave }: DataEditorProps<string>) {
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => {
        ref.current?.focus();
    }, []);

    const onKeyUp = (e: KeyboardEvent<HTMLInputElement>) => {
        switch (e.key) {
            case "Enter":
                onSave?.();
                break;
            case "Escape":
                onCancel?.();
                break;
        }
    };

    const _onChange = (e: ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    };

    return (
        <input onKeyUp={onKeyUp} ref={ref} value={value} onChange={_onChange} className={Styles.INPUT_UNSTYLED} style={{ fontSize: "inherit" }} />
    );
}

interface EditableTextProps extends Omit<EditableProps<string>, 'viewer' | 'editor'> {
    viewer?: ComponentType<DataViewerProps<string>>;
    editor?: ComponentType<DataEditorProps<string>>;
}
export function EditableText(props: EditableTextProps) {
    if (!props.viewer) {
        props.viewer = TextDataViewer;
    }

    if (!props.editor) {
        props.editor = TextDataEditor;
    }

    return (
        <Editable {...props as EditableProps<string>} />
    );
}
