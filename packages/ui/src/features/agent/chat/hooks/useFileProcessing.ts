import { useCallback, useEffect, useMemo, useState } from 'react';
import { AsyncExecutionResult, VertesiaClient } from '@vertesia/client';
import {
    ConversationFile,
    ConversationFileRef,
    FileProcessingStatus,
} from '@vertesia/common';

export interface UseFileProcessingResult {
    processingFiles: Map<string, ConversationFile>;
    hasProcessingFiles: boolean;
    handleFileUpload: (files: File[]) => Promise<void>;
}

type ToastFn = (opts: { status: 'success' | 'error' | 'warning' | 'info'; title: string; description?: string; duration?: number }) => void;

/**
 * Hook that manages file upload and processing state.
 *
 * Combines local optimistic upload state with server-side processing
 * status updates (from `useAgentStream.serverFileUpdates`).
 *
 * @param client - Vertesia client for artifact uploads and workflow signals
 * @param run - Current workflow execution
 * @param serverFileUpdates - Server-side file processing updates from useAgentStream
 * @param toast - Toast notification function for error display
 */
export function useFileProcessing(
    client: VertesiaClient,
    run: AsyncExecutionResult,
    serverFileUpdates: Map<string, ConversationFile>,
    toast: ToastFn,
): UseFileProcessingResult {
    // Local optimistic file state (uploads initiated from the UI)
    const [localFiles, setLocalFiles] = useState<Map<string, ConversationFile>>(new Map());

    // Reset when run changes
    useEffect(() => {
        setLocalFiles(new Map());
    }, [run.runId]);

    // Merge local + server state (server takes precedence for same IDs)
    const processingFiles = useMemo(() => {
        const merged = new Map(localFiles);
        serverFileUpdates.forEach((file, id) => {
            merged.set(id, file);
        });
        return merged;
    }, [localFiles, serverFileUpdates]);

    const hasProcessingFiles = useMemo(() =>
        Array.from(processingFiles.values()).some(
            f => f.status === FileProcessingStatus.UPLOADING || f.status === FileProcessingStatus.PROCESSING
        ), [processingFiles]);

    const handleFileUpload = useCallback(async (files: File[]) => {
        for (const file of files) {
            const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const artifactPath = `files/${file.name}`;

            // Add to local state immediately (optimistic - uploading status)
            const fileState: ConversationFile = {
                id: fileId,
                name: file.name,
                content_type: file.type || 'application/octet-stream',
                size: file.size,
                status: FileProcessingStatus.UPLOADING,
                started_at: Date.now(),
            };

            setLocalFiles(prev => new Map(prev).set(fileId, fileState));

            try {
                // Upload to artifact storage
                await client.files.uploadArtifact(run.runId, artifactPath, file);

                // Update local state to processing
                setLocalFiles(prev => {
                    const newMap = new Map(prev);
                    const f = newMap.get(fileId);
                    if (f) {
                        f.status = FileProcessingStatus.PROCESSING;
                        f.artifact_path = artifactPath;
                        f.reference = `artifact:${artifactPath}`;
                    }
                    return newMap;
                });

                // Signal workflow that file was uploaded
                await client.store.workflows.sendSignal(
                    run.workflowId,
                    run.runId,
                    'FileUploaded',
                    {
                        id: fileId,
                        name: file.name,
                        content_type: file.type || 'application/octet-stream',
                        reference: `artifact:${artifactPath}`,
                        artifact_path: artifactPath,
                    } as ConversationFileRef
                );
            } catch (error) {
                // Update local state to error
                setLocalFiles(prev => {
                    const newMap = new Map(prev);
                    const f = newMap.get(fileId);
                    if (f) {
                        f.status = FileProcessingStatus.ERROR;
                        f.error = error instanceof Error ? error.message : 'Upload failed';
                        f.completed_at = Date.now();
                    }
                    return newMap;
                });

                toast({
                    status: 'error',
                    title: 'Upload Failed',
                    description: error instanceof Error ? error.message : 'Failed to upload file',
                    duration: 3000,
                });
            }
        }
    }, [client, run, toast]);

    return { processingFiles, hasProcessingFiles, handleFileUpload };
}
