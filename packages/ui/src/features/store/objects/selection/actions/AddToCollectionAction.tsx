import { Button, DialogDescription, Heading, Modal, ModalBody, ModalFooter, ModalTitle, Portal, Tabs, TabsBar, TabsPanel, useToast } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { useCallback, useState } from "react";
import { useUITranslation } from '../../../../../i18n/index.js';
import { i18nInstance, NAMESPACE } from '../../../../../i18n/instance.js';
import { CreateCollectionForm, SelectCollection } from "../../../collections";
import { useObjectsActionCallback } from "../ObjectsActionHooks";
import { ActionComponentTypeProps, ObjectsActionSpec } from "../ObjectsActionSpec";

export function AddToCollectionActionComponent({ action, objectIds }: ActionComponentTypeProps) {
    const [showModal, setShowModal] = useState(false);
    const callback = useCallback(() => {
        if (objectIds.length > 0) {
            setShowModal(true);
        }
        return Promise.resolve(true);
    }, [objectIds])

    const onClose = () => {
        setShowModal(false)
    }

    useObjectsActionCallback(action.id, callback);

    return showModal && <Portal>
        <SelectCollectionModal objectIds={objectIds} isOpen={showModal} onClose={onClose} />
    </Portal>;
}

const t = i18nInstance.getFixedT(null, NAMESPACE);
export const AddToCollectionAction: ObjectsActionSpec = {
    id: "addToCollection",
    name: t('store.actions.addToCollection'),
    description: t('store.actions.addToCollectionDesc'),
    confirm: false,
    component: AddToCollectionActionComponent,
}


interface SelectCollectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    objectIds: string[];
}
function SelectCollectionModal({ isOpen, onClose, objectIds }: SelectCollectionModalProps) {
    const { t } = useUITranslation();
    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg w-full min-w-0 overflow-hidden">
            <ModalTitle className="flex flex-col min-w-0 overflow-hidden">
                {t('store.actions.addToCollectionTitle')}
            </ModalTitle>
            <DialogDescription className="min-w-0 overflow-hidden">
                {t('store.actions.addToCollectionBody')}
            </DialogDescription>
            <div className="min-w-0 max-w-full overflow-hidden">
                <AddToCollectionForm onClose={onClose} objectIds={objectIds} />
            </div>
        </Modal>
    )
}

interface AddToCollectionFormProps {
    objectIds: string[];
    onClose: () => void;
}
function AddToCollectionForm({ onClose, objectIds }: AddToCollectionFormProps) {
    const { t } = useUITranslation();
    const toast = useToast();
    const { client } = useUserSession();
    const [selectedCollectionId, setSelectedCollectionId] = useState<string>();
    const onAddToCollection = ({ collectionId }: { collectionId: string }) => {
        if (!collectionId || !objectIds?.length) {
            return;
        }
        client.store.collections.addMembers(collectionId, objectIds).then(() => {
            toast({
                title: t('store.actions.addToCollectionSuccess'),
                status: 'success',
                description: t('store.actions.addToCollectionSuccessDesc', { count: objectIds.length }),
                duration: 3000
            });
            onClose();
        }).catch(() => {
            toast({
                title: t('store.actions.addToCollectionFailure'),
                status: 'error',
                description: t('store.actions.addToCollectionFailureDesc'),
                duration: 5000
            });
        });
    }

    const onCollectionChange = (collectionId: string | string[] | undefined, _collection?: any) => {
        if (typeof collectionId === "string" || typeof collectionId === "undefined") {
            setSelectedCollectionId(collectionId);
        } else if (Array.isArray(collectionId) && collectionId.length > 0) {
            setSelectedCollectionId(collectionId[0]);
        } else {
            setSelectedCollectionId(undefined);
        }
    };

    const tabs = [
        {
            name: 'select',
            label: t('store.actions.selectCollection'),
            content: (
                <div className="p-4 min-w-0 max-w-full overflow-hidden">
                    <Heading level={5}>{t('store.actions.chooseExistingCollections')}</Heading>
                    <ModalBody className="min-w-0 max-w-full overflow-hidden">
                        <div className="mb-4 min-w-0 max-w-full overflow-hidden">
                            <SelectCollection onChange={onCollectionChange} value={selectedCollectionId} />
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            isDisabled={!selectedCollectionId}
                            onClick={() => selectedCollectionId && onAddToCollection({ collectionId: selectedCollectionId })}
                        >
                            {t('store.actions.addToCollectionButton')}
                        </Button>
                    </ModalFooter>
                </div>
            )
        },
        {
            name: 'create',
            label: t('store.actions.createNew'),
            content:
                <div className="p-4">
                    <CreateCollectionForm onClose={onClose} onAddToCollection={(id: string) => onAddToCollection({ collectionId: id })} redirect={false} />
                </div>
        }
    ];

    return (
        <Tabs defaultValue="select" tabs={tabs} fullWidth>
            <TabsBar />
            <TabsPanel />
        </Tabs>
    )
}