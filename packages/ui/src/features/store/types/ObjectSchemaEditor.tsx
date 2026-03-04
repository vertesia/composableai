import { useMemo, useRef, useState } from 'react';

import { useUserSession } from '@vertesia/ui/session';
import { MonacoEditor, EditorApi, SchemaEditor, useSchema } from '@vertesia/ui/widgets';
import { Button, useToast, useTheme, Panel } from '@vertesia/ui/core';
import { ContentObjectType } from '@vertesia/common';
import { Ajv } from "ajv";

interface ObjectSchemaEditorProps {
    objectType: ContentObjectType;
    onSchemaUpdate: (jsonSchema: any) => void;
    readonly?: boolean;
}
export function ObjectSchemaEditor({ objectType, onSchemaUpdate, readonly = false }: ObjectSchemaEditorProps) {
    const { store } = useUserSession();
    const toast = useToast();
    const { theme } = useTheme();

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
                validateSchema(newSchema);
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

    const title = (
        <div className='flex gap-2 items-center'><div className="text-base font-semibold">Schema Editor</div>
            {!readonly && <div>
                <Button variant="outline" size="sm" onClick={handleOnSave}>
                    {
                        displayJson ? "Edit Schema" : "Edit Json"
                    }
                </Button>
            </div>}
        </div>
    );

    return (
        <Panel title={title} className="bg-background! h-[calc(100vh-197px)]"
            action={!readonly ? <Button isLoading={isUpdating} variant="outline" size="sm" onClick={onSave}>Save Changes</Button> : undefined}
        >
            {
                displayJson
                    ? <MonacoEditor
                        value={value}
                        language="json"
                        editorRef={editorRef}
                        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                        options={{ readOnly: readonly }}
                    />
                    : <SchemaEditor schema={schema} readonly={readonly} />
            }


        </ Panel>
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

const validateSchema = (schema: Record<string, any>) => {
    try {
        const ajv = new Ajv({
            strict: false, // Enable strict mode to ensure all properties are validated
        });
        // Compile the schema. This implicitly validates the schema definition
        // against the JSON Schema draft that ajv supports by default.
        ajv.compile(schema);
    } catch (error: any) {
        throw new Error(`Invalid JSON Schema definition: ${error.message}`);
    }
};