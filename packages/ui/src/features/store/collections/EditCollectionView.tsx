import { json } from "@codemirror/lang-json";
import { Collection, CreateCollectionPayload } from "@vertesia/common";
import { Button, ErrorBox, FormItem, Input, Styles, useFetch, useToast } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { CodeMirrorEditor, EditorApi, GeneratedForm, ManagedObject } from "@vertesia/ui/widgets";
import { basicSetup } from "codemirror";
import { useMemo, useRef, useState } from "react";
import { SelectContentType, stringifyTableLayout } from "../types";

const extensions = [basicSetup, json()];

interface UpdateData {
    name: string;
    description: string;
    query: string;
    tags: string[];
    type: string;
    allowed_types: string[];
}

interface EditCollectionViewProps {
    collection: Collection;
    refetch: () => void;
}
export function EditCollectionView({ refetch, collection }: EditCollectionViewProps) {
    const typeId = collection.type?.id;
    const tableLayoutRef = useRef<EditorApi | undefined>(undefined);
    const toast = useToast();
    const { client } = useUserSession();
    const [isUpdating, setUpdating] = useState(false);
    const [metadata, setMetadata] = useState<UpdateData>({
        name: collection.name,
        description: collection.description || "",
        query: collection.query ? JSON.stringify(collection.query, null, 2) : "",
        tags: collection.tags || [],
        type: collection.type?.id || "",
        allowed_types: collection.allowed_types || [],
    });

    const tableLayoutValue = useMemo(() => {
        return stringifyTableLayout(collection.table_layout);
    }, [collection.table_layout]);

    const onSubmit = () => {
        const query = metadata.query ? JSON.parse(metadata.query) : undefined;
        const payload: Partial<CreateCollectionPayload> = {
            name: metadata.name,
            description: metadata.description,
            query: query,
            tags: metadata.tags,
            type: metadata.type,
            allowed_types: metadata.allowed_types,
        };
        let error: string | undefined;
        if (!payload.name) {
            error = "Name is required";
        }
        if (!payload.type) {
            (payload as any).type = null;
        }
        if (error) {
            toast({
                title: "Validation failed",
                description: error,
                status: "error",
                duration: 5000,
            });
        }
        if (tableLayoutRef.current) {
            const layout = tableLayoutRef.current.getValue();
            if (layout) {
                try {
                    payload.table_layout = JSON.parse(layout);
                } catch (err: any) {
                    toast({
                        title: "Invalid Table Layout",
                        description: err.message,
                        status: "error",
                        duration: 5000,
                    });
                    return;
                }
            } else {
                payload.table_layout = null;
            }
        }
        setUpdating(true);
        client.store.collections
            .update(collection.id, payload)
            .then(() => {
                refetch();
                toast({
                    title: "Collection updated",
                    description: "Collection has been updated successfully",
                    status: "success",
                    duration: 3000,
                });
            })
            .catch((err) => {
                toast({
                    title: "Failed to update collection",
                    description: err.message,
                    status: "error",
                    duration: 5000,
                });
            })
            .finally(() => {
                setUpdating(false);
            });
    };

    const setField = (name: string, value: any) => {
        setMetadata({
            ...metadata,
            [name]: value,
        });
    };

    return (
        <div className="flex flex-col gap-4 py-2">
            <FormItem label="Name" required>
                <Input value={metadata.name} onChange={(v) => setField("name", v)} />
            </FormItem>
            <FormItem label="Description">
                <textarea
                    className={Styles.INPUT}
                    value={metadata.description}
                    onChange={(e) => setField("description", e.target.value)}
                />
            </FormItem>
            {
                !collection.dynamic &&
                <FormItem label="Allowed Content Types" description="Select which content types can be added to the collection. If not set, then all content types are allowed.">
                    <SelectContentType
                        defaultValue={metadata.allowed_types || null}
                        onChange={(v) => {
                            if (Array.isArray(v)) {
                                setField("allowed_types", v.map(type => type.id));
                            } else {
                                setField("allowed_types", v ? [v.id] : []);
                            }
                        }}
                        isClearable multiple
                    />
                </FormItem>
            }
            {collection.dynamic && (
                <FormItem label="Query" description="Define the query to dynamically fetch content for the collection.">
                    <textarea
                        className={Styles.INPUT}
                        value={metadata.query}
                        onChange={(e) => setField("query", e.target.value)}
                    />
                </FormItem>
            )}
            <FormItem label="Table Layout" description="Define a custom layout for displaying the collection in tables.">
                <CodeMirrorEditor className="border-1 rounded-md border-border"
                    value={tableLayoutValue} extensions={extensions} editorRef={tableLayoutRef} />
            </FormItem>
            <FormItem label="Type" description="Select a content type to assign custom properties and data to the collection.">
                <SelectContentType
                    defaultValue={metadata.type || null}
                    onChange={(v) => {
                        if (Array.isArray(v)) {
                            setField("type", v.length > 0 ? v[0].id : null);
                        } else {
                            setField("type", v?.id || null);
                        }
                    }}
                    isClearable
                />
            </FormItem>
            <Button size="lg" className="w-min my-4" isDisabled={isUpdating} onClick={onSubmit}>
                Save Metadata
            </Button>

            {typeId && <PropertiesEditor typeId={typeId} collection={collection} />}
        </div>
    );
}

interface PropertiesEditorProps {
    typeId: string;
    collection: Collection;
}
function PropertiesEditor({ typeId, collection }: PropertiesEditorProps) {
    const { client } = useUserSession();
    const { data: type, error } = useFetch(() => client.store.types.retrieve(typeId), [typeId]);
    if (error) {
        return <ErrorBox title="Failed to load type">{error.message}</ErrorBox>;
    }

    return (
        <Section title="Properties">
            {type && <PropertiesForm collection={collection} schema={type.object_schema} />}
        </Section>
    );
}

interface PropertiesFormProps {
    schema: any;
    collection: Collection;
}
function PropertiesForm({ schema = {}, collection }: PropertiesFormProps) {
    const { client } = useUserSession();
    const toast = useToast();
    const object = useMemo(() => new ManagedObject(schema, collection.properties || {}), [schema, collection]);
    const [isUpdating, setIsUpdating] = useState(false);

    const _onSave = (data: any) => {
        const payload = { properties: data || {} };
        setIsUpdating(true);
        client.store.collections
            .update(collection.id, payload)
            .then(() => {
                toast({
                    title: "Collection properties updated",
                    description: "Collection has been updated successfully",
                    status: "success",
                    duration: 3000,
                });
            })
            .catch((err) => {
                toast({
                    title: "Failed to update collection properties",
                    description: err.message,
                    status: "error",
                    duration: 5000,
                });
            })
            .finally(() => {
                setIsUpdating(false);
            });
    };

    return (
        <GeneratedForm object={object} onSubmit={_onSave}>
            <Button size="lg" isLoading={isUpdating} className="my-4" variant="primary" type="submit">
                Save Properties
            </Button>
        </GeneratedForm>
    );
}

interface SectionProps {
    children: React.ReactNode;
    title: string;
}
function Section({ children, title }: SectionProps) {
    return (
        <div className="my-4">
            <div className="text-lg text-gray-700 font-semibold border-b border-b-gray-300 py-2 mb-4">{title}</div>
            {children}
        </div>
    );
}
