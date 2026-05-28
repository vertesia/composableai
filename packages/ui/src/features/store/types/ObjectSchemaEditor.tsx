import { useMemo, useRef, useState } from 'react';

import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { MonacoEditor, type EditorApi, SchemaEditor, useSchema } from '@vertesia/ui/widgets';
import { Button, errorMessage, useToast, useTheme, Panel } from '@vertesia/ui/core';
import type { ContentObjectType } from '@vertesia/common';
import { Ajv } from 'ajv';

interface ObjectSchemaEditorProps {
    objectType: ContentObjectType;
    onSchemaUpdate: (jsonSchema: unknown) => void;
    readonly?: boolean;
}
export function ObjectSchemaEditor({ objectType, onSchemaUpdate, readonly = false }: ObjectSchemaEditorProps) {
    const { store } = useUserSession();
    const { t } = useUITranslation();
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
                return;
            }
        }

        setUpdating(true);
        store.types
            .update(objectType.id, { object_schema: schema.schema })
            .then(() => {
                onSchemaUpdate(schema);
                toast({
                    status: 'success',
                    title: t('store.schemaUpdated'),
                    description: t('store.schemaUpdatedSuccess'),
                    duration: 2000,
                });
            })
            .catch((err) => {
                toast({
                    status: 'error',
                    title: t('store.failedToUpdateSchema'),
                    description: err.message,
                    duration: 5000,
                });
            })
            .finally(() => {
                setUpdating(false);
            });
    };

    const handleOnSave = () => {
        if (displayJson) {
            if (!updateSchemaFromJson()) {
                return;
            }
        }

        setDisplayJson((prev) => !prev);
    };

    const updateSchemaFromJson = () => {
        if (editorRef.current) {
            const value = editorRef.current.getValue();
            try {
                const newSchema = contentToJson(value);
                validateSchema(newSchema);
                schema.replaceSchema(newSchema);
            } catch (err: unknown) {
                toast({
                    status: 'error',
                    title: t('store.invalidJsonSchema'),
                    description: errorMessage(err),
                    duration: 5000,
                });
                return false;
            }
        }
        return true;
    };

    const title = (
        <div className="flex gap-2 items-center">
            <div className="text-base font-semibold">{t('store.schemaEditor')}</div>
            {!readonly && (
                <div>
                    <Button variant="outline" size="sm" onClick={handleOnSave}>
                        {displayJson ? t('store.editSchema') : t('store.editJson')}
                    </Button>
                </div>
            )}
        </div>
    );

    return (
        <Panel
            title={title}
            className="bg-background! h-full"
            action={
                !readonly ? (
                    <Button isLoading={isUpdating} variant="outline" size="sm" onClick={onSave}>
                        {t('modal.saveChanges')}
                    </Button>
                ) : undefined
            }
        >
            {displayJson ? (
                <MonacoEditor
                    value={value}
                    language="json"
                    editorRef={editorRef}
                    theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                    options={{ readOnly: readonly }}
                />
            ) : (
                <SchemaEditor schema={schema} readonly={readonly} />
            )}
        </Panel>
    );
}

function jsonToContent(json: unknown | undefined | null) {
    if (!json) {
        return '';
    }

    return JSON.stringify(json, null, 2);
}

function contentToJson(content: string | undefined | null) {
    if (!content?.trim()) {
        return undefined;
    }

    return JSON.parse(content.trim());
}

const validateSchema = (schema: Record<string, unknown>) => {
    try {
        const ajv = new Ajv({
            strict: false, // Enable strict mode to ensure all properties are validated
        });
        // Compile the schema. This implicitly validates the schema definition
        // against the JSON Schema draft that ajv supports by default.
        ajv.compile(schema);
    } catch (error: unknown) {
        throw new Error(`Invalid JSON Schema definition: ${errorMessage(error)}`, { cause: error });
    }
};
