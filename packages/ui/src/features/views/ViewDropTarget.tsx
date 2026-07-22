import type { ExecuteViewRequest, ViewExecutionDefinition, ViewExecutionResult } from '@vertesia/common';
import { Spinner, useToast } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { DropZone } from '@vertesia/ui/widgets';
import { type DragEvent, type ReactNode, useCallback, useRef, useState } from 'react';
import { DocumentUploadModal } from '../store/objects/upload/DocumentUploadModal.js';
import type { ViewDropContribution } from './types.js';

interface ViewDropTargetProps {
    children: ReactNode;
    definition: ViewExecutionDefinition;
    request: ExecuteViewRequest;
    result: ViewExecutionResult;
    contribution?: ViewDropContribution;
    canWrite: boolean;
    refresh: () => Promise<void>;
}

function droppedFiles(event: DragEvent<HTMLDivElement>): File[] {
    if (event.dataTransfer.items) {
        return Array.from(event.dataTransfer.items)
            .filter((item) => item.kind === 'file')
            .map((item) => item.getAsFile())
            .filter((file): file is File => file !== null);
    }
    return Array.from(event.dataTransfer.files);
}

export function ViewDropTarget({
    children,
    definition,
    request,
    result,
    contribution,
    canWrite,
    refresh,
}: ViewDropTargetProps) {
    const { t } = useUITranslation();
    const toast = useToast();
    const configuration = definition.results?.drop;
    const builtinEnabled = configuration?.handler === 'upload' && canWrite;
    const enabled = contribution !== undefined || builtinEnabled;
    const [isDragging, setIsDragging] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const runningRef = useRef(false);

    const handleFiles = useCallback(
        async (nextFiles: File[]) => {
            if (!nextFiles.length) return;
            if (contribution) {
                if (runningRef.current) return;
                runningRef.current = true;
                setIsRunning(true);
                try {
                    await contribution.run({ configuration, files: nextFiles, definition, request, result, refresh });
                } catch (error: unknown) {
                    console.error('View drop action failed:', error);
                    toast({
                        status: 'error',
                        title: t('view.dropFailed'),
                        description: t('view.actionFailedDescription'),
                    });
                } finally {
                    runningRef.current = false;
                    setIsRunning(false);
                }
                return;
            }
            if (builtinEnabled) setFiles(nextFiles);
        },
        [builtinEnabled, configuration, contribution, definition, refresh, request, result, t, toast],
    );

    if (!enabled) return children;

    const params = configuration?.params;
    return (
        <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: HTML has no dedicated semantic element for a native file drop target. */}
            <div
                className="relative min-h-48"
                onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                }}
                onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={(event) => {
                    event.preventDefault();
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false);
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsDragging(false);
                    if ((event.target as Element).closest('[data-view-drop-zone]')) return;
                    void handleFiles(droppedFiles(event));
                }}
            >
                {children}
                {isRunning && (
                    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/80">
                        <Spinner size="xl" />
                    </div>
                )}
                <div
                    data-view-drop-zone
                    className={`pointer-events-none absolute inset-0 ${isDragging ? 'z-50' : '-z-10'}`}
                >
                    <DropZone
                        onDrop={(nextFiles) => void handleFiles(nextFiles)}
                        message={t('view.dropFiles')}
                        buttonLabel={t('view.selectFiles')}
                        allowFolders={params?.allow_folders ?? true}
                        className={`pointer-events-auto absolute inset-0 bg-background/90 ${isDragging ? 'flex' : 'hidden'}`}
                    />
                </div>
            </div>
            {builtinEnabled && (
                <DocumentUploadModal
                    isOpen={files.length > 0}
                    onClose={() => setFiles([])}
                    files={files}
                    collectionId={params?.collection_id}
                    selectedFolder={params?.location}
                    initialTypeId={params?.type_id}
                    defaultProperties={params?.properties}
                    allowFolders={params?.allow_folders ?? true}
                    title={t('view.uploadToView')}
                    onUploadComplete={(uploadResult) => {
                        if (uploadResult.success) void refresh();
                    }}
                />
            )}
        </>
    );
}
