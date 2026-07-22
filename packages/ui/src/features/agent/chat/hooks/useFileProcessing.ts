import type { VertesiaClient } from '@vertesia/client';
import { type ConversationFile, type ConversationFileRef, FileProcessingStatus } from '@vertesia/common';
import { i18nInstance, NAMESPACE } from '@vertesia/ui/i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface UseFileProcessingResult {
    processingFiles: Map<string, ConversationFile>;
    hasProcessingFiles: boolean;
    handleFileUpload: (files: File[]) => Promise<void>;
    removeProcessingFile: (fileId: string) => Promise<void>;
    clearProcessingFiles: () => void;
}

type ToastFn = (opts: {
    status: 'success' | 'error' | 'warning' | 'info';
    title: string;
    description?: string;
    duration?: number;
}) => void;

type LocalConversationFile = ConversationFile & { preview_url?: string };

function isPreviewableImage(file: File): boolean {
    return file.type.startsWith('image/');
}

function createPreviewUrl(file: File): string | undefined {
    if (!isPreviewableImage(file) || typeof URL === 'undefined' || !URL.createObjectURL) return undefined;
    return URL.createObjectURL(file);
}

function revokePreviewUrlValue(previewUrl: string): void {
    if (typeof URL !== 'undefined' && URL.revokeObjectURL) {
        URL.revokeObjectURL(previewUrl);
    }
}

/**
 * Hook that manages file upload and processing state.
 *
 * Combines local optimistic upload state with server-side processing
 * status updates (from `useAgentStream.serverFileUpdates`).
 *
 * @param client - Vertesia client for artifact uploads and agent signals
 * @param agentRunId - Stable AgentRun ID
 * @param serverFileUpdates - Server-side file processing updates from useAgentStream
 * @param toast - Toast notification function for error display
 */
export function useFileProcessing(
    client: VertesiaClient,
    agentRunId: string,
    serverFileUpdates: Map<string, ConversationFile>,
    toast: ToastFn,
): UseFileProcessingResult {
    const t = i18nInstance.getFixedT(null, NAMESPACE);
    // Local optimistic file state (uploads initiated from the UI)
    const [localFiles, setLocalFiles] = useState<Map<string, ConversationFile>>(new Map());
    const [removedFileIds, setRemovedFileIds] = useState<Set<string>>(new Set());
    const removedFileIdsRef = useRef<Set<string>>(new Set());
    const previewUrlsRef = useRef<Map<string, string>>(new Map());
    const previousAgentRunId = useRef(agentRunId);
    // Kept current so clearProcessingFiles() can read the latest tracked ids
    // imperatively without being re-created on every render.
    const localFilesRef = useRef(localFiles);
    localFilesRef.current = localFiles;
    const serverFileUpdatesRef = useRef(serverFileUpdates);
    serverFileUpdatesRef.current = serverFileUpdates;

    const revokePreviewUrl = useCallback((fileId: string) => {
        const previewUrl = previewUrlsRef.current.get(fileId);
        if (previewUrl) {
            revokePreviewUrlValue(previewUrl);
            previewUrlsRef.current.delete(fileId);
        }
    }, []);

    // Reset when agentRunId changes
    useEffect(() => {
        if (previousAgentRunId.current !== agentRunId) {
            previousAgentRunId.current = agentRunId;
            previewUrlsRef.current.forEach(revokePreviewUrlValue);
            previewUrlsRef.current.clear();
            setLocalFiles(new Map());
            const nextRemovedFileIds = new Set<string>();
            removedFileIdsRef.current = nextRemovedFileIds;
            setRemovedFileIds(nextRemovedFileIds);
        }
    }, [agentRunId]);

    useEffect(() => {
        return () => {
            previewUrlsRef.current.forEach(revokePreviewUrlValue);
            previewUrlsRef.current.clear();
        };
    }, []);

    // Merge local + server state (server takes precedence for same IDs)
    const processingFiles = useMemo(() => {
        const merged = new Map<string, ConversationFile>();
        localFiles.forEach((file, id) => {
            if (!removedFileIds.has(id)) {
                merged.set(id, file);
            }
        });
        serverFileUpdates.forEach((file, id) => {
            if (!removedFileIds.has(id)) {
                // Server updates are authoritative for status, but may omit fields the local
                // optimistic entry already knows: preview_url is never sent by the server, and
                // artifact_path/reference can be absent on some updates. Backfill them from local
                // so the sent-message embed and thumbnail resolution keep working.
                const local = localFiles.get(id) as LocalConversationFile | undefined;
                merged.set(id, {
                    ...file,
                    artifact_path: file.artifact_path ?? local?.artifact_path,
                    reference: file.reference ?? local?.reference,
                    ...(local?.preview_url ? { preview_url: local.preview_url } : {}),
                } as LocalConversationFile);
            }
        });
        return merged;
    }, [localFiles, removedFileIds, serverFileUpdates]);

    const hasProcessingFiles = useMemo(
        () =>
            Array.from(processingFiles.values()).some(
                (f) => f.status === FileProcessingStatus.UPLOADING || f.status === FileProcessingStatus.PROCESSING,
            ),
        [processingFiles],
    );

    const handleFileUpload = useCallback(
        async (files: File[]) => {
            for (const file of files) {
                const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const artifactPath = `files/${file.name}`;
                const previewUrl = createPreviewUrl(file);
                if (previewUrl) previewUrlsRef.current.set(fileId, previewUrl);

                // Add to local state immediately (optimistic - uploading status)
                const fileState: LocalConversationFile = {
                    id: fileId,
                    name: file.name,
                    content_type: file.type || 'application/octet-stream',
                    size: file.size,
                    status: FileProcessingStatus.UPLOADING,
                    started_at: Date.now(),
                    preview_url: previewUrl,
                };

                setLocalFiles((prev) => new Map(prev).set(fileId, fileState));

                try {
                    // Upload to artifact storage
                    await client.agents.uploadArtifact(agentRunId, artifactPath, file);

                    // Update local state to processing
                    setLocalFiles((prev) => {
                        const newMap = new Map(prev);
                        const f = newMap.get(fileId);
                        if (f) {
                            f.status = FileProcessingStatus.PROCESSING;
                            f.artifact_path = artifactPath;
                            f.reference = `artifact:${artifactPath}`;
                        }
                        return newMap;
                    });

                    if (removedFileIdsRef.current.has(fileId)) {
                        continue;
                    }

                    // Signal agent that file was uploaded
                    await client.agents.sendSignal(agentRunId, 'FileUploaded', {
                        id: fileId,
                        name: file.name,
                        content_type: file.type || 'application/octet-stream',
                        reference: `artifact:${artifactPath}`,
                        artifact_path: artifactPath,
                    } as ConversationFileRef);
                } catch (error) {
                    if (removedFileIdsRef.current.has(fileId)) {
                        continue;
                    }

                    // Update local state to error
                    setLocalFiles((prev) => {
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
                        title: t('agent.uploadFailed'),
                        description: error instanceof Error ? error.message : 'Failed to upload file',
                        duration: 3000,
                    });
                }
            }
        },
        [client, agentRunId, toast, t],
    );

    const removeProcessingFile = useCallback(
        async (fileId: string) => {
            setRemovedFileIds((prev) => {
                if (prev.has(fileId)) return prev;
                const next = new Set(prev);
                next.add(fileId);
                removedFileIdsRef.current = next;
                return next;
            });
            setLocalFiles((prev) => {
                if (!prev.has(fileId)) return prev;
                const next = new Map(prev);
                next.delete(fileId);
                return next;
            });
            revokePreviewUrl(fileId);

            try {
                await client.agents.sendSignal(agentRunId, 'FileRemoved', { id: fileId });
            } catch (error) {
                toast({
                    status: 'error',
                    title: t('agent.removeFileFailed'),
                    description: error instanceof Error ? error.message : 'Failed to remove file',
                    duration: 3000,
                });
            }
        },
        [agentRunId, client, revokePreviewUrl, t, toast],
    );

    // Clears the composer's uploaded-file chips after a message is sent. Unlike
    // removeProcessingFile, this does NOT signal FileRemoved — the agent already
    // received these files via FileUploaded, so the message consumes them rather
    // than retracting them. The ids are added to removedFileIds so the server echo
    // in the merge above cannot re-add a chip once the message has been sent.
    const clearProcessingFiles = useCallback(() => {
        previewUrlsRef.current.forEach(revokePreviewUrlValue);
        previewUrlsRef.current.clear();
        setRemovedFileIds((prev) => {
            const next = new Set(prev);
            for (const id of serverFileUpdatesRef.current.keys()) next.add(id);
            for (const id of localFilesRef.current.keys()) next.add(id);
            removedFileIdsRef.current = next;
            return next;
        });
        setLocalFiles(new Map());
    }, []);

    return { processingFiles, hasProcessingFiles, handleFileUpload, removeProcessingFile, clearProcessingFiles };
}
