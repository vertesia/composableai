import { type Collection, type CreateCollectionPayload, getContentTypeRefId, type JSONSchemaObject, SecurityLevelLabels } from "@vertesia/common";
import { Badge, Button, ErrorBox, FormItem, Input, Panel, SelectBox, Styles, Textarea, errorMessage, useFetch, useToast, useTheme } from "@vertesia/ui/core";
import { SharedPropsEditor } from "./SharedPropsEditor";
import { SyncMemberHeadsToggle } from "./SyncMemberHeadsToggle";
import { UserInfo } from "../../user/UserInfo";
import { useUserSession } from "@vertesia/ui/session";
import { MonacoEditor, type EditorApi, GeneratedForm, ManagedObject, type Node } from "@vertesia/ui/widgets";
import dayjs from "dayjs";
import { useContext, useMemo, useRef, useState } from "react";
import { useUITranslation } from '@vertesia/ui/i18n';
import { SearchContext } from "../objects/search/DocumentSearchContext";
import { SelectContentType, stringifyTableLayout } from "../types";

interface UpdateData {
    name: string;
    description: string;
    query: string;
    tags: string[];
    type: string;
    allowed_types: string[];
    sensitivity?: number;
    compartments: string[];
}

interface EditCollectionViewProps {
    collection: Collection;
    refetch: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function EditCollectionView({ refetch, collection }: EditCollectionViewProps) {
    const { t } = useUITranslation();
    const typeId = collection.type ? getContentTypeRefId(collection.type) : undefined;
    const tableLayoutRef = useRef<EditorApi | undefined>(undefined);
    const toast = useToast();
    const { theme } = useTheme();
    const { client } = useUserSession();
    const search = useContext(SearchContext);
    const [isUpdating, setUpdating] = useState(false);
    const [metadata, setMetadata] = useState<UpdateData>({
        name: collection.name,
        description: collection.description || "",
        query: collection.query ? JSON.stringify(collection.query, null, 2) : "",
        tags: collection.tags || [],
        type: collection.type ? getContentTypeRefId(collection.type) : "",
        allowed_types: collection.allowed_types || [],
        sensitivity: collection.sensitivity,
        compartments: collection.compartments || [],
    });
    const [compartmentInput, setCompartmentInput] = useState('');

    const tableLayoutValue = useMemo(() => {
        return stringifyTableLayout(collection.table_layout);
    }, [collection.table_layout]);

    const onSubmit = () => {
        let query: Record<string, unknown> | undefined;
        try {
            const parsedQuery = metadata.query ? JSON.parse(metadata.query) : undefined;
            if (parsedQuery !== undefined && !isRecord(parsedQuery)) {
                throw new Error(t('store.invalidQueryJson'));
            }
            query = parsedQuery;
        } catch (err: unknown) {
            toast({
                title: t('store.invalidQueryJson'),
                description: errorMessage(err),
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
            sensitivity: metadata.sensitivity,
            compartments: metadata.compartments,
        };
        let error: string | undefined;
        if (!payload.name) {
            error = t('type.nameRequired');
        }
        if (!payload.type) {
            payload.type = null;
        }
        if (error) {
            toast({
                title: t('store.validationFailed'),
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
                } catch (err: unknown) {
                    toast({
                        title: t('store.invalidTableLayout'),
                        description: errorMessage(err),
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
                // Update search query on provider if it's a dynamic collection to reflect in UI immediately
                if (collection.dynamic && search) {
                    search.reset();
                    void search.search();
                }
                toast({
                    title: t('store.collectionUpdated'),
                    description: t('store.collectionUpdatedSuccess'),
                    status: "success",
                    duration: 3000,
                });
            })
            .catch((err) => {
                toast({
                    title: t('store.failedToUpdateCollection'),
                    description: errorMessage(err),
                    status: "error",
                    duration: 5000,
                });
            })
            .finally(() => {
                setUpdating(false);
            });
    };

    const setField = (name: string, value: unknown) => {
        setMetadata({
            ...metadata,
            [name]: value,
        });
    };

    return (
        <div className="flex flex-col gap-4 py-2">
            <Panel title={t('store.configuration')}
                action={
                    <Button size="lg" isDisabled={isUpdating} onClick={onSubmit}>
                        {t('modal.save')}
                    </Button>
                }>
                <div className="flex justify-between mb-2">
                    <div className="w-1/2 gap-2 flex flex-col">
                        <div className="text-sm font-medium mb-1">{t('store.createdBy')}</div>
                        <div className="gap-2 flex items-center">
                            <UserInfo userRef={collection.created_by} showTitle />
                            <span>at {dayjs(collection.created_at).format("YYYY-MM-DD HH:mm:ss")}</span>
                        </div>
                    </div>
                    <div className="w-1/2 gap-2 flex flex-col">
                        <div className="text-sm font-medium mb-1">{t('store.updatedBy')}</div>
                        <div className="gap-2 flex items-center">
                            <UserInfo userRef={collection.updated_by} showTitle />
                            <span>at {dayjs(collection.updated_at).format("YYYY-MM-DD HH:mm:ss")}</span>
                        </div>
                    </div>
                </div>
                <FormItem label={t('type.name')} required>
                    <Input value={metadata.name} onChange={(v) => setField("name", v)} />
                </FormItem>
                <FormItem label={t('type.description')}>
                    <Textarea
                        value={metadata.description}
                        onChange={(e) => setField("description", e.target.value)}
                    />
                </FormItem>
                {
                    !collection.dynamic &&
                    <FormItem label={t('store.allowedContentTypes')} description={t('store.allowedContentTypesSelectDescription')}>
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
                        <FormItem label={t('store.query')} description={t('store.queryDescription')}>
                            <Textarea
                                className={Styles.INPUT}
                                minLines={1}
                                maxLines={12}
                                value={metadata.query}
                                onChange={(e) => setField("query", e.target.value)}
                            />
                        </FormItem>
                    )
                }
                <FormItem label={t('store.tableLayout')} description={t('store.tableLayoutDescription')} className="h-[200px]">
                    <MonacoEditor
                        className="border-1 rounded-md border-border"
                        value={tableLayoutValue}
                        language="json"
                        editorRef={tableLayoutRef}
                        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                    />
                </FormItem>
                <FormItem label={t('store.contentType')} description={t('store.typeSelectDescription')}>
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
                <FormItem label="Sensitivity" description="BLP sensitivity level — propagated to member documents (max across collections)">
                    <SelectBox
                        options={SecurityLevelLabels.map((label, index) => ({ label: `${index} — ${label}`, value: index }))}
                        value={metadata.sensitivity !== undefined ? { label: `${metadata.sensitivity} — ${SecurityLevelLabels[metadata.sensitivity] ?? 'Unknown'}`, value: metadata.sensitivity } : undefined}
                        onChange={(opt: { label: string; value: number }) => setField('sensitivity', opt.value)}
                        optionLabel={(opt: { label: string }) => opt.label}
                        by="value"
                        placeholder="Not set"
                    />
                </FormItem>
                <FormItem label="Compartments" description="Security compartments — propagated to member documents (union across collections)">
                    <div className="flex gap-2">
                        <Input
                            value={compartmentInput}
                            onChange={setCompartmentInput}
                            placeholder="Add a compartment"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const val = compartmentInput.trim();
                                    if (val && !metadata.compartments.includes(val)) {
                                        setField('compartments', [...metadata.compartments, val]);
                                        setCompartmentInput('');
                                    }
                                }
                            }}
                        />
                        <Button type="button" variant="outline" onClick={() => {
                            const val = compartmentInput.trim();
                            if (val && !metadata.compartments.includes(val)) {
                                setField('compartments', [...metadata.compartments, val]);
                                setCompartmentInput('');
                            }
                        }}>Add</Button>
                    </div>
                    <div className="flex gap-1 flex-wrap mt-2">
                        {metadata.compartments.map((c) => (
                            <Badge key={c} variant="secondary" className="cursor-pointer"
                                onClick={() => setField('compartments', metadata.compartments.filter(x => x !== c))}>
                                {c} ×
                            </Badge>
                        ))}
                    </div>
                </FormItem>
            </Panel>

            {typeId && <PropertiesEditor typeId={typeId} collection={collection} />}
            {
                !collection.dynamic && (
                    <>
                        <SyncMemberHeadsToggle collection={collection} />
                        <SharedPropsEditor collection={collection} />
                    </>
                )
            }

        </div >
    );
}

interface PropertiesEditorProps {
    typeId: string;
    collection: Collection;
}
function PropertiesEditor({ typeId, collection }: PropertiesEditorProps) {
    const { t } = useUITranslation();
    const [formData, setFormData] = useState<JSONSchemaObject>({});
    const toast = useToast();
    const { client } = useUserSession();
    const [isUpdating, setIsUpdating] = useState(false);

    const { data: type, error } = useFetch(() => client.store.types.catalog.resolve(typeId), [typeId]);
    const schema = type?.object_schema || {};
    const object = useMemo(() => new ManagedObject(schema, (collection.properties as JSONSchemaObject | undefined) || {}), [schema, collection.properties]);

    if (error) {
        return <ErrorBox title={t('store.failedToLoadType')}>{errorMessage(error)}</ErrorBox>;
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
                    title: t('store.collectionPropertiesUpdated'),
                    description: t('store.collectionUpdatedSuccess'),
                    status: "success",
                    duration: 3000,
                });
            })
            .catch((err) => {
                toast({
                    title: t('store.failedToUpdateCollectionProperties'),
                    description: errorMessage(err),
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
        <Panel title={t('store.properties')} action={
            <Button size="lg" isLoading={isUpdating} type="submit" onClick={() => _onSave(formData)}>
                {t('modal.save')}
            </Button>}
        >
            <GeneratedForm object={object} onChange={onDataChanged} />
        </Panel>
    );
}
