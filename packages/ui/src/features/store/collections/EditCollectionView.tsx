import { json } from "@codemirror/lang-json";
import dayjs from "dayjs";
import { basicSetup } from "codemirror";
import { useMemo, useRef, useState } from "react";
import { UserInfo } from "@vertesia/ui/features";
import { useUserSession } from "@vertesia/ui/session";
import { Collection, CreateCollectionPayload, JSONSchemaObject } from "@vertesia/common";
import { CodeMirrorEditor, EditorApi, GeneratedForm, ManagedObject, Node } from "@vertesia/ui/widgets";
import { Button, ErrorBox, FormItem, Input, Styles, Textarea, useFetch, useToast, Panel } from "@vertesia/ui/core";
import { SelectContentType, stringifyTableLayout } from "../types";
import { SharedPropsEditor } from "@vertesia/ui/features/store/collections/SharedPropsEditor";

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
        let query: any = undefined;
        try {
            query = metadata.query ? JSON.parse(metadata.query) : undefined;
        } catch (err: any) {
            toast({
                title: "Invalid Query JSON",
                description: err.message,
                status: "error",
                duration: 5000,
            });
            return;
        }

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
            return;
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
            <Panel title="Configuration"
                action={
                    <Button size="lg" isDisabled={isUpdating} onClick={onSubmit}>
                        Save
                    </Button>
                }>
                <div className="flex justify-between mb-2">
                    <div className="w-1/2 gap-2 flex flex-col">
                        <div className="text-sm font-medium mb-1">Created By</div>
                        <div className="gap-2 flex items-center">
                            <UserInfo userRef={collection.created_by} showTitle />
                            <span>at {dayjs(collection.created_at).format("YYYY-MM-DD HH:mm:ss")}</span>
                        </div>
                    </div>
                    <div className="w-1/2 gap-2 flex flex-col">
                        <div className="text-sm font-medium mb-1">Updated By</div>
                        <div className="gap-2 flex items-center">
                            <UserInfo userRef={collection.updated_by} showTitle />
                            <span>at {dayjs(collection.updated_at).format("YYYY-MM-DD HH:mm:ss")}</span>
                        </div>
                    </div>
                </div>
                <FormItem label="Name" required>
                    <Input value={metadata.name} onChange={(v) => setField("name", v)} />
                </FormItem>
                <FormItem label="Description">
                    <Textarea
                        value={metadata.description}
                        onChange={(e) => setField("description", e)}
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
                {
                    collection.dynamic && (
                        <FormItem label="Query" description="Define the query to dynamically fetch content for the collection.">
                            <Textarea
                                className={Styles.INPUT}
                                value={metadata.query}
                                onChange={(e) => setField("query", e)}
                            />
                        </FormItem>
                    )
                }
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
            </Panel>

            {typeId && <PropertiesEditor typeId={typeId} collection={collection} />}
            {
                !collection.dynamic &&
                <FormItem label="Shared Properties" description="Add properties to share across all members in the collection. This feature requires to enable shared property synchronization on the project.">
                    <SharedPropsEditor collection={collection} />
                </FormItem>
            }

        </div >
    );
}

interface PropertiesEditorProps {
    typeId: string;
    collection: Collection;
}
function PropertiesEditor({ typeId, collection }: PropertiesEditorProps) {
    const [formData, setFormData] = useState<JSONSchemaObject>({});
    const toast = useToast();
    const { client } = useUserSession();
    const [isUpdating, setIsUpdating] = useState(false);

    const { data: type, error } = useFetch(() => client.store.types.retrieve(typeId), [typeId]);
    const schema = type?.object_schema || {};
    const object = useMemo(() => new ManagedObject(schema, collection.properties || {}), [schema, collection.properties]);

    if (error) {
        return <ErrorBox title="Failed to load type">{error.message}</ErrorBox>;
    }

    if (!type) {
        return null;
    }


    const _onSave = (data: JSONSchemaObject) => {
        if (!data || !Object.keys(data).length) {
            return;
        }
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

    const onDataChanged = (data: Node) => {
        if (data instanceof ManagedObject) {
            setFormData(data.value);
        }
    }

    return (
        <Panel title="Properties" action={
            <Button size="lg" isLoading={isUpdating} type="submit" onClick={() => _onSave(formData)}>
                Save
            </Button>}
        >
            <GeneratedForm object={object} onChange={onDataChanged} />
        </Panel>
    );
}
