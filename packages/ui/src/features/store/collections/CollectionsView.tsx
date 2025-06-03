import { FormItem } from "@vertesia/ui/core";
import { GenericPageNavHeader } from "@vertesia/ui/features";
import { useUserSession } from "@vertesia/ui/session";
import {
    Button,
    VModal,
    VModalBody,
    VModalFooter,
    VModalTitle,
    Styles,
    Switch,
    useToast,
    Input,
} from "@vertesia/ui/core";
import { useFlag } from "@vertesia/ui/core";
import { FullHeightLayout } from "@vertesia/ui/layout";
import { useNavigate } from "@vertesia/ui/router";
import { CreateCollectionPayload } from "@vertesia/common";
import { useState } from "react";
import { CollectionsTable } from "./CollectionsTable";
import { SelectContentType } from "@vertesia/ui/features";

interface CollectionsViewProps { }
export function CollectionsView({ }: CollectionsViewProps) {
    const actions = [<CreateCollectionButton key="create" />];
    return (
        <FullHeightLayout>
            <GenericPageNavHeader
                title="Collections"
                breadcrumbs={[<span key="0">Collections</span>]}
                description="Group objects together using a collection"
                actions={actions}
            />
            <FullHeightLayout.Body>
                <CollectionsTable />
            </FullHeightLayout.Body>
        </FullHeightLayout>
    );
}

function CreateCollectionButton() {
    const { on, off, isOn } = useFlag();
    return (
        <div>
            <VModal onClose={off} isOpen={isOn}>
                <VModalTitle>Create a Collection</VModalTitle>
                <CreateCollectionForm onClose={off} />
            </VModal>
            <Button onClick={on}>Create Collection</Button>
        </div>
    );
}

interface CreateCollectionFormProps {
    onClose: () => void;
    redirect?: boolean
    onAddToCollection?: (collectionId: string) => void;
}
export function CreateCollectionForm({ onClose, redirect = true, onAddToCollection }: CreateCollectionFormProps) {
    const navigate = useNavigate();
    const toast = useToast();
    const [isProcessing, setProcessing] = useState(false);
    const { client } = useUserSession();
    const [payload, setPayload] = useState<CreateCollectionPayload>({
        dynamic: false,
        name: "",
        description: "",
    });

    function setPayloadProp(name: string, value: any) {
        setPayload({
            ...payload,
            [name]: value,
        });
    }

    const onCreate = () => {
        if (!payload?.name || !payload.name.trim()) {
            toast({
                title: "Name is required",
                description: "Please provide a name for the collection",
                status: "error",
                duration: 5000,
            });
            return;
        }
        payload.name = payload.name.trim();
        if (payload.description) {
            payload.description = payload.description.trim();
        }
        if (payload.dynamic == null) {
            payload.dynamic = false;
        }
        setProcessing(true);
        client.store.collections
            .create(payload as CreateCollectionPayload)
            .then((r) => {
                onClose();
                toast({
                    title: "Collection created",
                    description: `Collection "${r.name}" created successfully`,
                    status: "success",
                    duration: 3000,
                });
                if (redirect)
                    navigate(`/collections/${r.id}`);
                if (onAddToCollection) {
                    onAddToCollection(r.id);
                }
            })
            .catch((err) => {
                toast({
                    title: "Failed to create collection",
                    description: err.message,
                    status: "error",
                    duration: 5000,
                });
            })
            .finally(() => setProcessing(false));
    };

    return (
        <form>
            <VModalBody>
                <FormItem label="Name" required>
                    <Input type="text" value={payload.name || ""} onChange={(value) => setPayloadProp("name", value)} />
                </FormItem>
                <FormItem label="Description" className="mt-2">
                    <textarea
                        className={Styles.INPUT}
                        value={payload.description || ""}
                        onChange={(ev) => setPayloadProp("description", ev.target.value)}
                    />
                </FormItem>
                <FormItem label="Dynamic Collection" className="mt-2" direction="row" description="Dynamic Collection is based on a query vs. users manully adding content.">
                    <Switch value={payload.dynamic || false} onChange={(value) => setPayloadProp("dynamic", value)} />
                </FormItem>
                <FormItem label="Type" className="mt-2" description="This is optional and drives what properties are used to describe a collection">
                    <SelectContentType
                        defaultValue={payload.type || null}
                        onChange={(v) => {
                            if (Array.isArray(v)) {
                                setPayloadProp("type", v.length > 0 ? v[0].id : null);
                            } else {
                                setPayloadProp("type", v?.id || null);
                            }
                        }}
                        isClearable
                    />
                </FormItem>
                <FormItem label="Allowed Content Types" className="mt-4">
                    <SelectContentType
                        defaultValue={payload.allowed_types || null}
                        onChange={(v) => {
                            if (Array.isArray(v)) {
                                setPayloadProp("allowed_types", v.map(type => type.id));
                            } else {
                                setPayloadProp("allowed_types", v ? [v.id] : []);
                            }
                        }}
                        isClearable multiple
                    />
                </FormItem>
            </VModalBody>
            <VModalFooter>
                <Button isDisabled={isProcessing} onClick={onCreate}>
                    Create Collection
                </Button>
            </VModalFooter>
        </form >
    );
}
