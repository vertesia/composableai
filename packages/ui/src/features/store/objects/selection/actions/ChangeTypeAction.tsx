import { useToast } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { useCallback, useState } from "react";
import { SelectContentTypeModal } from "../../../types";
import { useObjectsActionCallback } from "../ObjectsActionContext";
import { ActionComponentTypeProps, ObjectsActionSpec } from "../ObjectsActionSpec";

export function ChangeTypeActionComponent({ action, objectIds, children }: ActionComponentTypeProps) {
    const { store } = useUserSession();
    const toast = useToast();
    const [isOpen, setOpen] = useState(false);
    const callback = useCallback(() => {
        setOpen(true);
        return Promise.resolve(true);
    }, [])

    useObjectsActionCallback(action.id, callback);

    const handleTypeSelect = (typeId?: string | null | undefined) => {
        // Close the modal
        setOpen(false);

        // If no selection was made
        if (typeId === undefined) {
            return;
        }

        // Execute the operation with the selected typeId
        store.runOperation({
            name: "change_type",
            ids: objectIds,
            params: { typeId }
        }).then((r) => {
            toast({
                status: 'success',
                title: 'Change Type',
                description: `Change the type of ${objectIds.length} objects is ${r.status === 'in_progress' ? 'in progress' : 'completed'}`,
                duration: 2000
            });
        }).catch(err => {
            toast({
                status: 'error',
                title: 'Error changing type',
                description: err.message,
                duration: 5000
            });
        });
    };

    return (
        <div>
            {children}
            <SelectContentTypeModal
                isOpen={isOpen}
                onClose={handleTypeSelect}
                title="Change Content Type"
                confirmLabel="Change Type"
            >
                <p className="pt-2 text-xs">Note: This action will raise the <code>change_type</code> event and will trigger the standard intake workflows
                    which may reset the object properties.</p>
            </SelectContentTypeModal>
        </div>
    )
}

export const ChangeTypeAction: ObjectsActionSpec = {
    id: "changeType",
    name: 'Change Content Type',
    description: 'Change the Content Type of the selected documents',
    confirm: false,
    component: ChangeTypeActionComponent,
}
