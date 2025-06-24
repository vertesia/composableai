import { Button, Portal, useToast, VModal, VModalBody, VModalFooter, VModalTitle } from "@vertesia/ui/core";
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
        <VModal isOpen={isOpen} onClose={onClose}>
            <VModalTitle>Add to a Collection</VModalTitle>
            <AddToCollectionForm onClose={onClose} objectIds={objectIds} />
        </VModal>
    )
}

interface AddToCollectionFormProps {
    objectIds: string[];
    onClose: () => void;
}
function AddToCollectionForm({ onClose, objectIds }: AddToCollectionFormProps) {
    const toast = useToast();
    const { client } = useUserSession();
    const [selectedCol, setSelectedCol] = useState<any>();
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

    return (
        <>
            <VModalBody>
                <SelectCollection onChange={setSelectedCol} value={selectedCol} />
            </VModalBody>
            <VModalFooter>
                <Button isDisabled={!selectedCol} onClick={() => selectedCol && onAddToCollection({ collectionId: selectedCol.id })}>
                    Add to Collection
                </Button>
            </VModalFooter>
            <div className="flex items-center flex-row w-full text-muted">
                <hr className="w-full" />
                <div className="px-2 text-xs">OR</div>
                <hr className="w-full" />
            </div>
            <CreateCollectionForm onClose={onClose} onAddToCollection={(id: string) => onAddToCollection({ collectionId: id })} redirect={false} />
        </>
    )
}