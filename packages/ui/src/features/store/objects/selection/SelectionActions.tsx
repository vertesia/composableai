import type { ContentObjectTypeItem } from '@vertesia/common';
import { Button, Popover, PopoverContent, PopoverTrigger, SelectList } from '@vertesia/ui/core';
import clsx from 'clsx';
import { EllipsisVertical, X } from 'lucide-react';

import { useState } from 'react';
import { useUITranslation } from '@vertesia/ui/i18n';
import { type DocumentSelection, useDocumentSelection } from '../DocumentSelectionProvider.js';
import { DocumentUploadModal } from '../upload/DocumentUploadModal.js';
import { ExportPropertiesAction } from './actions/ExportPropertiesAction';
import { StartWorkflowAction } from './actions/StartWorkflowComponent';
import { ObjectsActionContextProvider } from './ObjectsActionContext';
import { useObjectsActionContext } from './ObjectsActionHooks';
import type { ObjectsActionSpec } from './ObjectsActionSpec';

interface SelectionActionsProps {
    type?: ContentObjectTypeItem;
    allowMutations?: boolean;
    allowDelete?: boolean;
    allowWorkflowRun?: boolean;
}
export function SelectionActions({
    type,
    allowMutations = true,
    allowDelete = true,
    allowWorkflowRun = true,
}: SelectionActionsProps) {
    const selection = useDocumentSelection();
    const size = selection.size();
    const plural = size > 1 ? 's' : '';

    const hasSelection = selection?.hasSelection();
    const hasSingleSelection = selection?.isSingleSelection();

    const onClearSelection = () => {
        selection?.removeAll();
    };

    return (
        <ObjectsActionContextProvider type={type}>
            <div className="flex items-center gap-x-2">
                {hasSelection && !hasSingleSelection && (
                    <div className="flex items-center gap-x-1 shrink-0">
                        <div className="text-sm nowrap">
                            {size} document{plural} selected
                        </div>
                        <Button title="Clear selection" variant={'ghost'} onClick={onClearSelection}>
                            <X className="size-4" />
                        </Button>
                    </div>
                )}
                <SelectionActionsPopover
                    selection={selection}
                    allowMutations={allowMutations}
                    allowDelete={allowDelete}
                    allowWorkflowRun={allowWorkflowRun}
                >
                    {(actions) =>
                        actions.length > 0 ? (
                            <Button variant="ghost" alt="More action" size="sm">
                                <EllipsisVertical size={16} />
                            </Button>
                        ) : null
                    }
                </SelectionActionsPopover>
                {/* StartWorkflowButton must be inside the context */}
                {hasSelection && allowWorkflowRun && <ActionsWrapper selection={selection} />}
            </div>
        </ObjectsActionContextProvider>
    );
}

// Wrapper component that accesses the context
interface ActionsWrapperProps {
    selection: DocumentSelection;
}
function ActionsWrapper(_props: ActionsWrapperProps) {
    return <StartWorkflowButton />;
}

export function UploadObjectsButton({
    collectionId,
    allowFolders = true,
}: {
    collectionId?: string;
    allowFolders?: boolean;
}) {
    const { t } = useUITranslation();
    const [files, setFiles] = useState<File[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    const onClose = () => {
        setIsOpen(false);
        setFiles([]);
    };

    return (
        <>
            <Button onClick={() => setIsOpen(true)}>{t('store.upload')}</Button>
            <DocumentUploadModal
                collectionId={collectionId ?? ''}
                isOpen={isOpen}
                onClose={onClose}
                files={files}
                title="Upload Files"
                onUploadComplete={(result) => {
                    if (result?.success) {
                        setFiles([]);
                    }
                }}
                allowFolders={allowFolders}
            ></DocumentUploadModal>
        </>
    );
}

function StartWorkflowButton() {
    const ctx = useObjectsActionContext();
    const { t } = useUITranslation();

    const selection = ctx.params.selection;
    const hasSelection = selection.hasSelection();

    return (
        hasSelection && (
            <Button onClick={() => ctx.run(StartWorkflowAction.id)}>{t('store.actions.startWorkflow')}</Button>
        )
    );
}
function optionLayout(option: ObjectsActionSpec) {
    return {
        label: option.name,
        className: clsx('flex-1 px-2 py-2 hover:bg-accent nowrap', option.destructive ? 'text-destructive' : ''),
    };
}

interface SelectionActionsPopoverProps {
    children: (actions: ObjectsActionSpec[]) => React.ReactNode;
    selection: DocumentSelection;
}
function SelectionActionsPopover({
    selection,
    children,
    allowMutations = true,
    allowDelete = true,
    allowWorkflowRun = true,
}: SelectionActionsPopoverProps & Required<Pick<SelectionActionsProps, 'allowMutations' | 'allowDelete' | 'allowWorkflowRun'>>) {
    const context = useObjectsActionContext();
    const executeAction = (action: ObjectsActionSpec) => {
        context.run(action.id);
    };
    const actions = getAvailableActions(context.actions, selection, {
        allowMutations,
        allowDelete,
        allowWorkflowRun,
    });
    const trigger = children(actions);

    if (!trigger) {
        return null;
    }

    return (
        <Popover hover>
            <PopoverTrigger>{trigger}</PopoverTrigger>
            <PopoverContent className="p-0 w-50" align="end" sideOffset={6}>
                <PopoverBody executeAction={executeAction} actions={actions} />
            </PopoverContent>
        </Popover>
    );
}

interface PopoverBodyProps {
    executeAction: (action: ObjectsActionSpec) => void;
    actions: ObjectsActionSpec[];
}
function PopoverBody({ executeAction, actions }: PopoverBodyProps) {
    const _executeAction = (action: ObjectsActionSpec) => {
        executeAction(action);
    };

    return (
        <div className="rounded-md shadow-md py-2">
            <div className="px-1 text-sm">
                <SelectList options={actions} optionLayout={optionLayout} onChange={_executeAction} noCheck />
            </div>
        </div>
    );
}

function getAvailableActions(
    actions: ObjectsActionSpec[],
    selection: DocumentSelection,
    permissions: Required<Pick<SelectionActionsProps, 'allowMutations' | 'allowDelete' | 'allowWorkflowRun'>>,
): ObjectsActionSpec[] {
    if (!selection?.hasSelection()) {
        return [ExportPropertiesAction];
    }

    return actions.filter((action: ObjectsActionSpec) => {
        if (action.hideInList) {
            return false;
        }
        if (action.id === 'startWorkflow') {
            return permissions.allowWorkflowRun;
        }
        if (action.id === 'delete' || action.id === 'deleteFromCollections') {
            return permissions.allowDelete;
        }
        if (
            action.id === 'changeType' ||
            action.id === 'addToCollection' ||
            action.id === 'removeFromCollection'
        ) {
            return permissions.allowMutations;
        }
        return true;
    });
}
