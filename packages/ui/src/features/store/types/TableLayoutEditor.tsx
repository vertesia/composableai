import { useMemo, useRef, useState } from 'react';
import { ColumnLayout, ContentObjectType } from '@vertesia/common';
import { Button, useToast, useTheme } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';
import { MonacoEditor, EditorApi } from '@vertesia/ui/widgets';

interface TableLayoutEditorProps {
    objectType: ContentObjectType;
    onLayoutUpdate: (value: ColumnLayout[] | undefined) => void;
}
export function TableLayoutEditor({ objectType, onLayoutUpdate }: TableLayoutEditorProps) {
    const toast = useToast();
    const { theme } = useTheme();

    const [isUpdating, setUpdating] = useState(false);
    const { store } = useUserSession();

    const editorRef = useRef<EditorApi | undefined>(undefined);

    const value = useMemo(() => {
        return stringifyTableLayout(objectType.table_layout);
    }, [objectType.table_layout])

    const validationError = (title: string, message: string) => {
        toast({
            status: 'error',
            title: title,
            description: message,
            duration: 5000
        })
    }

    const onSave = () => {
        if (!editorRef.current) {
            return;
        }
        const value = editorRef.current.getValue();
        let table_layout: ColumnLayout[] | null;
        if (!value) {
            table_layout = null;
        } else {
            try {
                table_layout = JSON.parse(value);
            } catch (err: any) {
                return validationError('Invalid JSON', err.message);
            }
        }

        if (!Array.isArray(table_layout)) {
            return validationError('Invalid JSON', 'The table layout must be an array');
        }
        if (table_layout.some((col) => !col || !col.name || !col.field)) {
            return validationError('Invalid JSON', 'A table layout entry must contain the following properties:] {field, name, converter?}');
        }

        setUpdating(true);
        store.types.update(objectType.id, {
            table_layout
        }).then((response) => {
            toast({
                status: 'success',
                title: 'Table Layout updated',
                description: 'The table layout has been updated successfully',
                duration: 2000
            });
            onLayoutUpdate(response.table_layout);
        }).catch((err) => {
            toast({
                status: 'error',
                title: 'Failed to update table layout',
                description: err.message,
                duration: 5000
            })
        }).finally(() => {
            setUpdating(false);
        });
    }


    return (
        <div className="mx-2 my-2 rounded-2xl border border-solid shadow-xs">
            <div className="flex items-center rounded-t-md border-b gap-x-2 py-2 pl-4 pr-2">
                <div className="text-base font-semibold ">Table Layout Editor</div>
                <div className="ml-auto flex gap-x-2">
                    <Button isLoading={isUpdating} variant="outline" size="sm" onClick={onSave}>Save Changes</Button>
                </div>
            </div>
            <div className="px-4 py-2">
                <MonacoEditor
                    value={value}
                    language="json"
                    editorRef={editorRef}
                    theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                />
            </div>
        </div>
    )
}


export function stringifyTableLayout(obj: any) {
    if (!obj) {
        return '[\n\n]';
    }
    return JSON.stringify(obj, null, 2);
}