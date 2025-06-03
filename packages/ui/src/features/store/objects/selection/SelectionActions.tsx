import { Button, Popover, PopoverContent, PopoverTrigger, SelectList } from '@vertesia/ui/core';
import clsx from 'clsx';
import { EllipsisVertical, X } from 'lucide-react';

import { useState } from "react";
import { DocumentSelection, DocumentUploadModal, useDocumentSelection } from "../../../store";
import { ExportPropertiesAction } from "./actions/ExportPropertiesAction";
import { StartWorkflowAction } from "./actions/StartWorkflowComponent";
import { ObjectsActionContextProvider, useObjectsActionContext } from "./ObjectsActionContext";
import { ObjectsActionSpec } from "./ObjectsActionSpec";

export function SelectionActions() {
    const selection = useDocumentSelection();
    const size = selection.size();
    const plural = size > 1 ? "s" : "";

    const hasSelection = selection?.hasSelection();
    const hasSingleSelection = selection?.isSingleSelection();

    const onClearSelection = () => {
        selection?.removeAll();
    };

    return (
        <ObjectsActionContextProvider>
            <div className="flex items-center gap-x-2">
                {hasSelection && !hasSingleSelection &&
                    <div className="flex items-center gap-x-1 shrink-0">
                        <div className='text-sm nowrap'>{size} document{plural} selected</div>
                        <Button title="Clear selection" variant={"ghost"}
                            className=" rounded-md p-2"
                            onClick={onClearSelection}>
                            <X className="size-4" />
                        </Button>
                    </div>
                }
                <SelectionActionsPopover selection={selection}>
                    <Button variant="ghost" alt="More action" size="sm">
                        <EllipsisVertical size={16} />
                    </Button>
                </SelectionActionsPopover>
                {/* StartWorkflowButton must be inside the context */}
                {hasSelection && <ActionsWrapper selection={selection} />}
            </div>
        </ObjectsActionContextProvider>
    )
}

// Wrapper component that accesses the context
interface ActionsWrapperProps {
    selection: DocumentSelection;
}
function ActionsWrapper({ }: ActionsWrapperProps) {
    return <StartWorkflowButton />;
}

export function UploadObjectsButton({ collectionId }: { collectionId?: string }) {
    const [files, setFiles] = useState<File[]>([]);
    const selection = useDocumentSelection();

    const hasSelection = selection?.hasSelection();

    const selectFile = () => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput?.click();
        fileInput.onchange = (event) => {
            const files = (event.target as HTMLInputElement).files;
            if (files) {
                setFiles(Array.from(files));
            }
        };
    };

    return (
        !hasSelection &&
        <>
            <Button onClick={() => selectFile()}>Upload</Button>
            <DocumentUploadModal
                collectionId={collectionId ?? ''}
                isOpen={files.length > 0}
                onClose={() => setFiles([])}
                files={files}
                title="Upload Files"
                onUploadComplete={(result) => {
                    if (result && result.success) {
                        setFiles([]);
                    }
                }}
            >
                <div className="text-sm">
                    Select the associated Content Type, or let the system choose or generate the type based on the
                    content.
                </div>
            </DocumentUploadModal>
        </>
    );
}

function StartWorkflowButton() {
    const ctx = useObjectsActionContext();

    const selection = ctx.params.selection;
    const hasSelection = selection.hasSelection();

    return (
        hasSelection &&
        <Button onClick={() => ctx.run(StartWorkflowAction.id)}>Start Workflow</Button>
    )
}
function optionLayout(option: ObjectsActionSpec) {
    return {
        label: option.name,
        className: clsx('flex-1 px-2 py-2 hover:bg-accent nowrap', option.destructive ? 'text-destructive' : ''),
    };
}

interface SelectionActionsPopoverProps {
    children: React.ReactNode;
    selection: DocumentSelection;
}
function SelectionActionsPopover({ selection, children }: SelectionActionsPopoverProps) {
    const context = useObjectsActionContext();
    const executeAction = (action: ObjectsActionSpec) => {
        context.run(action.id);
    };

    return (
        <Popover hover>
            <PopoverTrigger>
                {children}
            </PopoverTrigger >
            <PopoverContent className='p-0 w-50' align='end' sideOffset={6}>
                <PopoverBody executeAction={executeAction} selection={selection} />
            </PopoverContent>
        </Popover >
    )
}

interface PopoverBodyProps {
    executeAction: (action: ObjectsActionSpec) => void;
    selection: DocumentSelection;
}
function PopoverBody({ executeAction, selection }: PopoverBodyProps) {
    const context = useObjectsActionContext();

    const _executeAction = (action: ObjectsActionSpec) => {
        executeAction(action);
    }

    const _selection = selection?.hasSelection() ? context.actions.filter(action => !action.hideInList) : [ExportPropertiesAction];

    return (
        <div className="rounded-md shadow-md py-2">
            <div className="px-1 text-sm">
                <SelectList options={_selection} optionLayout={optionLayout} onChange={_executeAction} noCheck />
            </div>
        </div>
    );
}