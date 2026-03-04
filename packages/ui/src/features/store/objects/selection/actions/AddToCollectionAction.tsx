import { Button, DialogDescription, Heading, Portal, useToast, Modal, ModalBody, ModalFooter, ModalTitle, Tabs, TabsBar, TabsPanel } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { useCallback, useState } from "react";
import { CreateCollectionForm, SelectCollection } from "../../../collections";
import { useObjectsActionCallback } from "../ObjectsActionContext";
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

export const AddToCollectionAction: ObjectsActionSpec = {
    id: "addToCollection",
    name: 'Add to Collection',
    description: 'Add documents to a collection',
    confirm: false,
    component: AddToCollectionActionComponent,
}


interface SelectCollectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    objectIds: string[];
}
function SelectCollectionModal({ isOpen, onClose, objectIds }: SelectCollectionModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg w-full min-w-0 overflow-hidden">
            <ModalTitle className="flex flex-col min-w-0 overflow-hidden">
                Add to a Collection
            </ModalTitle>
            <DialogDescription className="min-w-0 overflow-hidden">
                Add the selected objects to an existing collection or create a new one.
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
    const toast = useToast();
    const { client } = useUserSession();
    const [selectedCollectionId, setSelectedCollectionId] = useState<string>();
    const onAddToCollection = ({ collectionId }: { collectionId: string }) => {
        if (!collectionId || !objectIds?.length) {
            return;
        }
        client.store.collections.addMembers(collectionId, objectIds).then(() => {
            toast({
                title: 'Add to collection success',
                status: 'success',
                description: `Added ${objectIds.length} objects to the selected collection`,
                duration: 3000
            });
            onClose();
        }).catch(() => {
            toast({
                title: 'Add to collection failure',
                status: 'error',
                description: `Failed to add the selected objects to the collection`,
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
            label: 'Select Collection',
            content: (
                <div className="p-4 min-w-0 max-w-full overflow-hidden">
                    <Heading level={5}>Choose from existing collections</Heading>
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
                            Add to Collection
                        </Button>
                    </ModalFooter>
                </div>
            )
        },
        {
            name: 'create',
            label: 'Create new',
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