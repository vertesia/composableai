import { CreateCollectionPayload } from "@vertesia/common";
import { useToast, ModalBody, FormItem, ModalFooter, Input, Switch, Button, Modal, ModalTitle, Textarea } from "@vertesia/ui/core";
import { SelectContentType } from "../types/SelectContentType";
import { useNavigate } from "@vertesia/ui/router";
import { useUserSession } from "@vertesia/ui/session";
import { useState } from "react";
import { useUITranslation } from '../../../i18n/index.js';

interface CreateCollectionFormProps {
    onClose: () => void;
    redirect?: boolean
    onAddToCollection?: (collectionId: string) => void;
}
export function CreateCollectionForm({ onClose, redirect = true, onAddToCollection }: CreateCollectionFormProps) {
    const navigate = useNavigate();
    const toast = useToast();
    const { t } = useUITranslation();
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
                title: t('type.nameRequired'),
                description: t('store.pleaseProvideName'),
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
                    title: t('store.collectionCreated'),
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
                    title: t('store.failedToCreateCollection'),
                    description: err.message,
                    status: "error",
                    duration: 5000,
                });
            })
            .finally(() => setProcessing(false));
    };

    return (
        <>
            <ModalBody>
                <form onSubmit={(e) => e.preventDefault()}>
                    <FormItem label={t('type.name')} required>
                        <Input type="text" value={payload.name || ""} onChange={(value) => setPayloadProp("name", value)} />
                    </FormItem>
                    <FormItem label={t('type.description')} className="mt-2">
                        <Textarea
                            value={payload.description || ""}
                            onChange={(ev) => setPayloadProp("description", ev.target.value)}
                        />
                    </FormItem>
                    <FormItem label={t('store.dynamicCollection')} className="mt-2" direction="row" description={t('store.dynamicCollectionDescription')}>
                        <Switch value={payload.dynamic || false} onChange={(value) => setPayloadProp("dynamic", value)} />
                    </FormItem>
                    {!payload.dynamic &&
                        <FormItem label={t('store.allowedContentTypes')} className="mt-4" description={t('store.allowedContentTypesOptionalDescription')}>
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
                    <FormItem label={t('store.contentType')} className="mt-2" description={t('store.typeDescription')}>
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
                </form>
            </ModalBody>
            <ModalFooter>
                <Button isDisabled={isProcessing} onClick={onCreate}>
                    {t('store.createCollection')}
                </Button>
            </ModalFooter>
        </>
    );
}

interface CreateCollectionModalProps {
    isOpen: boolean;
    onClose: () => void;
}
export function CreateCollectionModal({ isOpen, onClose }: CreateCollectionModalProps) {
    const { t } = useUITranslation();
    return (
        <Modal onClose={onClose} isOpen={isOpen}>
            <ModalTitle>{t('store.createACollection')}</ModalTitle>
            <CreateCollectionForm onClose={onClose} />
        </Modal>
    );
}