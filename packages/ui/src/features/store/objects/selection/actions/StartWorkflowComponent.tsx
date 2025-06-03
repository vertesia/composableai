import { useUserSession } from "@vertesia/ui/session";
import { Button, VModal, VModalBody, VModalFooter, VModalTitle, SelectList, useToast } from "@vertesia/ui/core";
import { useCallback, useState } from "react";
import { useObjectsActionCallback, useObjectsActionContext } from "../ObjectsActionContext";
import { ActionComponentTypeProps, ObjectsActionSpec } from "../ObjectsActionSpec";

export function StartWorkflowComponent({ action, objectIds, collectionId }: ActionComponentTypeProps) {
    const toast = useToast();
    const { client } = useUserSession();
    const [isOpen, setOpen] = useState(false);

    const callback = useCallback(() => {
        setOpen(true);
        return Promise.resolve(true);
    }, []);

    const onStartWorkflow = (workflowId?: string | undefined) => {
        setOpen(false);
        if (!workflowId) {
            return;
        }
        // const objectIds = params.selection.getObjectIds();
        // const workflowId = params.action.id;
        return client.store.workflows.rules
            .execute(workflowId, objectIds, { collection_id: collectionId })
            .then(() => {
                toast({
                    title: "Workflow started",
                    status: "success",
                    duration: 3000,
                });
            })
            .catch((err) => {
                toast({
                    title: "Error starting workflow",
                    status: "error",
                    description: err.message,
                    duration: 9000,
                });
            });
    };

    useObjectsActionCallback(action.id, callback);

    return <StartWorkflowModal isOpen={isOpen} onClose={onStartWorkflow} />;
}

export const StartWorkflowAction: ObjectsActionSpec = {
    id: "startWorkflow",
    name: "Start Workflow",
    description: "Start an workflow on the selected objects",
    confirm: false,
    hideInList: true,
    component: StartWorkflowComponent,
};

interface StartWorkflowModalProps {
    isOpen: boolean;
    onClose: (workflowId?: string | undefined) => void;
}
function StartWorkflowModal({ isOpen, onClose }: StartWorkflowModalProps) {
    return (
        <VModal onClose={() => onClose(undefined)} isOpen={isOpen} className="">
            <VModalTitle>Start a Workflow by Rule</VModalTitle>
            <StartWorkflowBody onClose={onClose} />
        </VModal>
    );
}

function optionLayout(option: ObjectsActionSpec) {
    return {
        label: (
            <div>
                <div>{option.name}</div>
                <div className="text-sm text-muted">{option.description}</div>
            </div>
        ),
        reverse: true,
    };
}

interface StartWorkflowBodyProps {
    onClose: (workflowId?: string | undefined) => void;
}
function StartWorkflowBody({ onClose }: StartWorkflowBodyProps) {
    const [selected, setSelected] = useState<ObjectsActionSpec | undefined>(undefined);
    const context = useObjectsActionContext();

    const onSelect = (value: ObjectsActionSpec) => {
        setSelected(value);
    };

    const onStart = () => {
        if (selected) {
            onClose(selected.id);
        }
    };

    return (
        <div>
            <VModalBody>
                <div className="pb-2">Choose a workflow rule to start:</div>
                <div className="max-h-[420px] overflow-y-scroll border-border border rounded-md">
                    <SelectList
                        options={context.wfRules}
                        optionLayout={optionLayout}
                        onChange={onSelect}
                        value={selected}
                    />
                </div>
            </VModalBody>
            <VModalFooter>
                <Button variant="secondary" onClick={() => onClose()}>
                    Cancel
                </Button>
                <Button onClick={onStart} isDisabled={!selected}>
                    Start
                </Button>
            </VModalFooter>
        </div>
    );
}
