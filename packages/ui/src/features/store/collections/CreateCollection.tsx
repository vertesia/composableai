import { CreateCollectionPayload } from "@vertesia/common";
import { useToast, VModalBody, FormItem, Styles, VModalFooter, Input, Switch, Button } from "@vertesia/ui/core";
import { SelectContentType } from "../types/SelectContentType";
import { useNavigate } from "@vertesia/ui/router";
import { useUserSession } from "@vertesia/ui/session";
import { useState } from "react";

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
                <FormItem label="Dynamic Collection" className="mt-2" direction="row" description="Dynamically fetch content for the collection based on a query. If not enabled, then content must be added by users or agents.">
                    <Switch value={payload.dynamic || false} onChange={(value) => setPayloadProp("dynamic", value)} />
                </FormItem>
                { !payload.dynamic &&
                    <FormItem label="Allowed Content Types" className="mt-4" description="Optionally select which content types can be added to the collection. If not set, then all content types are allowed.">
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
                }
                <FormItem label="Type" className="mt-2" description="Optionally select a content type to assign custom properties and data to the collection.">
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
            </VModalBody>
            <VModalFooter>
                <Button isDisabled={isProcessing} onClick={onCreate}>
                    Create Collection
                </Button>
            </VModalFooter>
        </form >
    );
}
