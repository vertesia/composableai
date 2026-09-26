import type { WorkflowDefinitionRef } from '@vertesia/common';
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
import { i18nInstance, NAMESPACE, useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { useCallback, useState } from 'react';
import { useObjectsActionCallback } from '../ObjectsActionHooks';
import type { ActionComponentTypeProps, ObjectsActionSpec } from '../ObjectsActionSpec';

/**
 * Endpoint prefix the server uses to resolve a workflow definition by id — see `DSL_WORKFLOW_PREFIX`
 * in `apps/zeno-server/src/workflow/temporal.ts`, which splits on `:` and loads the definition.
 */
const DSL_WORKFLOW_ENDPOINT_PREFIX = 'wf:';

export function StartWorkflowActionComponent({ action, objectIds, children }: ActionComponentTypeProps) {
    const [isOpen, setOpen] = useState(false);
    const callback = useCallback(() => {
        setOpen(true);
        return Promise.resolve(true);
    }, []);

    useObjectsActionCallback(action.id, callback);

    return (
        <div>
            {children}
            {/* Mounted only while open so the definitions list is fetched on demand, not on every render of the toolbar. */}
            {isOpen && <StartWorkflowModal objectIds={objectIds} onClose={() => setOpen(false)} />}
        </div>
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
    const [selected, setSelected] = useState<WorkflowDefinitionRef | undefined>(undefined);
    const [isStarting, setIsStarting] = useState(false);

    const { data: workflows, isLoading, error } = useFetch(() => client.store.workflows.definitions.list(), []);

    const onStart = async () => {
        if (!selected || isStarting) return;
        setIsStarting(true);
        try {
            // `objectIds` rather than the newer `input` shape: it is what the workflow rules API
            // already sends, so it is the form DSL workflows are known to read.
            await client.store.workflows.execute(`${DSL_WORKFLOW_ENDPOINT_PREFIX}${selected.id}`, { objectIds });
            toast({
                title: t('store.actions.workflowStarted'),
                description: t('store.actions.workflowStartedOn', { count: objectIds.length, name: selected.name }),
                status: 'success',
                duration: 3000,
            });
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
        <Modal isOpen onClose={onClose} size="md">
            <ModalTitle>{t('store.actions.startWorkflow')}</ModalTitle>
            <ModalBody>
                <div className="pb-2">{t('store.actions.chooseWorkflow')}</div>
                <StartWorkflowList
                    workflows={workflows}
                    isLoading={isLoading}
                    error={error}
                    selected={selected}
                    onChange={setSelected}
                />
            </ModalBody>
            <ModalFooter align="right">
                <Button variant="outline" onClick={onClose} disabled={isStarting}>
                    {t('modal.cancel')}
                </Button>
                <Button onClick={onStart} isDisabled={!selected || isStarting} isLoading={isStarting}>
                    {t('store.actions.start')}
                </Button>
            </ModalFooter>
        </Modal>
    );
}

interface StartWorkflowListProps {
    workflows: WorkflowDefinitionRef[] | undefined;
    isLoading: boolean;
    error: Error | undefined;
    selected: WorkflowDefinitionRef | undefined;
    onChange: (workflow: WorkflowDefinitionRef) => void;
}

function StartWorkflowList({ workflows, isLoading, error, selected, onChange }: StartWorkflowListProps) {
    const { t } = useUITranslation();

    if (isLoading) {
        return (
            <div className="flex justify-center py-4">
                <Spinner />
            </div>
        );
    }

    if (error) {
        return <div className="py-4 text-sm text-destructive">{t('store.failedToFetchWorkflows')}</div>;
    }

    if (!workflows?.length) {
        return <div className="py-4 text-sm text-muted">{t('store.actions.noWorkflowsAvailable')}</div>;
    }

    return (
        <div className="max-h-[420px] overflow-y-auto border-border border rounded-md">
            <SelectList
                className="text-start w-full"
                options={workflows}
                value={selected}
                onChange={onChange}
                optionLayout={(workflow) => ({
                    label: (
                        <div className="w-full">
                            <div className="text-start">{workflow.name.replace(/(?<=[a-z])(?=[A-Z])/g, ' ')}</div>
                            {workflow.description && <div className="text-xs text-muted">{workflow.description}</div>}
                        </div>
                    ),
                })}
            />
        </div>
    );
}

const t = i18nInstance.getFixedT(null, NAMESPACE);
export const StartWorkflowAction: ObjectsActionSpec = {
    id: 'startWorkflow',
    name: t('store.actions.startWorkflow'),
    description: t('store.actions.startWorkflowDesc'),
    confirm: false,
    component: StartWorkflowActionComponent,
};
