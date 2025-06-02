import { basicSetup } from 'codemirror';
import { useMemo, useRef, useState } from 'react';

import { useUserSession } from '@vertesia/ui/session';
import { json } from '@codemirror/lang-json';
import { CodeMirrorEditor, EditorApi } from '@vertesia/ui/widgets';
import { Button, useToast } from '@vertesia/ui/core';
import { SchemaEditor, useSchema } from '@vertesia/ui/widgets';
import { ContentObjectType } from '@vertesia/common';

const CODE_MIRROR_EXTENSIONS = [basicSetup, json()];

interface ObjectSchemaEditorProps {
    objectType: ContentObjectType;
    onSchemaUpdate: (jsonSchema: any) => void;
}
export function ObjectSchemaEditor({ objectType, onSchemaUpdate }: ObjectSchemaEditorProps) {
    const { store } = useUserSession();
    const toast = useToast();

    const [isUpdating, setUpdating] = useState(false);
    const schema = useSchema(objectType.object_schema);
    const editorRef = useRef<EditorApi | undefined>(undefined);
    const [displayJson, setDisplayJson] = useState(false);

    const value = useMemo(() => {
        return jsonToContent(schema.schema);
    }, [schema]);

    const onSave = () => {
        if (displayJson) {
            if (!updateSchemaFromJson()) {
                return
            }
        }

        setUpdating(true);
        store.types.update(objectType.id, { object_schema: schema.schema }).then(() => {
            onSchemaUpdate(schema);
            toast({
                status: 'success',
                title: 'Schema updated',
                description: 'The schema has been updated successfully',
                duration: 2000
            });
        }).catch((err) => {
            toast({
                status: 'error',
                title: 'Failed to update schema',
                description: err.message,
                duration: 5000
            })
        }).finally(() => {
            setUpdating(false);
        });
    };

    const handleOnSave = () => {
        if (displayJson) {
            if (!updateSchemaFromJson()) {
                return
            }
        }

        setDisplayJson(prev => !prev)
    };

    const updateSchemaFromJson = () => {
        if (editorRef.current) {
            const value = editorRef.current.getValue();
            try {
                const newSchema = contentToJson(value);
                schema.replaceSchema(newSchema);
            } catch (err: any) {
                toast({
                    status: 'error',
                    title: 'Invalid JSON Schema',
                    description: err.message,
                    duration: 5000
                })
                return false;
            }
        }
        return true;
    };

    return (
        <div className="mx-2 my-2 rounded-md border border-solid shadow-md border-spacing-2">
            <div className="flex items-center rounded-t-md border-b gap-x-2 py-2 px-4">
                <div className="text-lg font-semibold">Schema Editor</div>
                <div>
                    <Button variant="outline" size="sm" onClick={handleOnSave}>
                        {
                            displayJson ? "Edit Schema" : "Edit Json"
                        }
                    </Button>
                </div>
                <div className="ml-auto flex gap-x-2">
                    <Button isLoading={isUpdating} variant="outline" size="sm" onClick={onSave}>Save Changes</Button>
                </div>
            </div>
            <div className="px-4 py-2">
                {
                    displayJson
                        ? <CodeMirrorEditor value={value} extensions={CODE_MIRROR_EXTENSIONS} editorRef={editorRef} />
                        : <SchemaEditor schema={schema} />
                }
            </div>
        </div>
    );
}

function jsonToContent(json: any | undefined | null) {
    if (!json) {
        return ''
    }

    return JSON.stringify(json, null, 2);
}

function contentToJson(content: string | undefined | null) {
    if (!content?.trim()) {
        return undefined;
    }

    return JSON.parse(content.trim());
}
