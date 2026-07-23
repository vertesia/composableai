import type { WorkflowRuleItem } from '@vertesia/common';
import {
    Button,
    Modal,
    ModalBody,
    ModalFooter,
    ModalTitle,
    SelectList,
    Spinner,
    useFetch,
    useToast,
} from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { useState } from 'react';
import { useDocumentSelection } from '../../DocumentSelectionProvider.js';

/**
 * Standalone "Start Workflow" button for the content objects toolbar. Renders only when objects are
 * selected; opens a modal to pick a workflow rule and runs it on the selected object ids. Gated by
 * the caller via the `allowWorkflowRun` prop on {@link SelectionActions}.
 */
export function StartWorkflowButton() {
    const { t } = useUITranslation();
    const selection = useDocumentSelection();
    const [isOpen, setOpen] = useState(false);

    if (!selection?.hasSelection()) {
        return null;
    }

    return (
        <>
            <Button onClick={() => setOpen(true)}>{t('store.actions.startWorkflow')}</Button>
            {isOpen && <StartWorkflowModal objectIds={selection.getObjectIds()} onClose={() => setOpen(false)} />}
        </>
    );
}

interface StartWorkflowModalProps {
    objectIds: string[];
    onClose: () => void;
}

function StartWorkflowModal({ objectIds, onClose }: StartWorkflowModalProps) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const toast = useToast();
    const [selected, setSelected] = useState<WorkflowRuleItem | undefined>(undefined);
    const [isStarting, setIsStarting] = useState(false);

    const { data: rules, isLoading } = useFetch(() => client.store.workflows.rules.list(), []);

    const onStart = async () => {
        if (!selected || isStarting) return;
        setIsStarting(true);
        try {
            await client.store.workflows.rules.execute(selected.id, objectIds);
            toast({ title: t('store.actions.workflowStarted'), status: 'success', duration: 3000 });
            onClose();
        } catch (err: unknown) {
            toast({
                title: t('store.actions.errorStartingWorkflow'),
                description: err instanceof Error ? err.message : undefined,
                status: 'error',
                duration: 9000,
            });
        } finally {
            setIsStarting(false);
        }
    };

    return (
        <Modal isOpen onClose={onClose}>
            <ModalTitle>{t('store.actions.startWorkflowByRule')}</ModalTitle>
            <ModalBody>
                <div className="pb-2">{t('store.actions.chooseWorkflowRule')}</div>
                {isLoading ? (
                    <div className="flex justify-center py-4">
                        <Spinner />
                    </div>
                ) : (
                    <div className="max-h-[420px] overflow-y-auto border-border border rounded-md">
                        <SelectList
                            className="text-start"
                            options={rules ?? []}
                            value={selected}
                            onChange={setSelected}
                            optionLayout={(rule) => ({ label: rule.name })}
                        />
                    </div>
                )}
            </ModalBody>
            <ModalFooter align="right">
                <Button variant="outline" onClick={onClose} disabled={isStarting}>
                    Cancel
                </Button>
                <Button onClick={onStart} isDisabled={!selected || isStarting} isLoading={isStarting}>
                    Start
                </Button>
            </ModalFooter>
        </Modal>
    );
}
