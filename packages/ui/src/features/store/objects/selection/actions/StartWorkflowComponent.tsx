import { useUserSession } from "@vertesia/ui/session";
import { Button, Modal, ModalBody, ModalFooter, ModalTitle, SelectList, useToast } from "@vertesia/ui/core";
import { useCallback, useState } from "react";
import { useUITranslation } from '../../../../../i18n/index.js';
import { i18nInstance, NAMESPACE } from '../../../../../i18n/instance.js';
import { useObjectsActionCallback, useObjectsActionContext } from "../ObjectsActionContext";
import { ActionComponentTypeProps, ObjectsActionSpec } from "../ObjectsActionSpec";

export function StartWorkflowComponent({ action, objectIds, collectionId }: ActionComponentTypeProps) {
    const { t } = useUITranslation();
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
                    title: t('store.actions.workflowStarted'),
                    status: "success",
                    duration: 3000,
                });
            })
            .catch((err) => {
                toast({
                    title: t('store.actions.errorStartingWorkflow'),
                    status: "error",
                    description: err.message,
                    duration: 9000,
                });
            });
    };

    useObjectsActionCallback(action.id, callback);

    return <StartWorkflowModal isOpen={isOpen} onClose={onStartWorkflow} />;
}

const t = i18nInstance.getFixedT(null, NAMESPACE);
export const StartWorkflowAction: ObjectsActionSpec = {
    id: "startWorkflow",
    name: t('store.actions.startWorkflow'),
    description: t('store.actions.startWorkflowDesc'),
    confirm: false,
    hideInList: true,
    component: StartWorkflowComponent,
};

interface StartWorkflowModalProps {
    isOpen: boolean;
    onClose: (workflowId?: string | undefined) => void;
}
function StartWorkflowModal({ isOpen, onClose }: StartWorkflowModalProps) {
    const { t } = useUITranslation();
    return (
        <Modal onClose={() => onClose(undefined)} isOpen={isOpen} className="">
            <ModalTitle>{t('store.actions.startWorkflowByRule')}</ModalTitle>
            <StartWorkflowBody onClose={onClose} />
        </Modal>
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
    const { t } = useUITranslation();
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
            <ModalBody>
                <div className="pb-2">{t('store.actions.chooseWorkflowRule')}</div>
                <div className="max-h-[420px] overflow-y-scroll border-border border rounded-md">
                    <SelectList
                        options={context.wfRules}
                        optionLayout={optionLayout}
                        onChange={onSelect}
                        value={selected}
                    />
                </div>
            </ModalBody>
            <ModalFooter>
                <Button variant="secondary" onClick={() => onClose()}>
                    Cancel
                </Button>
                <Button onClick={onStart} isDisabled={!selected}>
                    Start
                </Button>
            </ModalFooter>
        </div>
    );
}
