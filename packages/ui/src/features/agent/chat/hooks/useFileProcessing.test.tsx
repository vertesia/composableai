import { act, renderHook, waitFor } from '@testing-library/react';
import type { VertesiaClient } from '@vertesia/client';
import { type AgentArtifactUrlResponse, type ConversationFile, FileProcessingStatus } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { useFileProcessing } from './useFileProcessing';

function createClient() {
    return {
        agents: {
            uploadArtifact: vi.fn().mockResolvedValue({ url: 'https://example.test/upload', path: 'files/wrong.png' }),
            sendSignal: vi.fn().mockResolvedValue({ status: 'success' }),
        },
    } as unknown as VertesiaClient;
}

function createReadyFile(id: string): ConversationFile {
    return {
        id,
        name: 'wrong.png',
        content_type: 'image/png',
        size: 1,
        status: FileProcessingStatus.READY,
        started_at: 1_000,
    };
}

describe('useFileProcessing', () => {
    it('removes a processing file and ignores later server updates for that file', async () => {
        const client = createClient();
        const toast = vi.fn();
        const serverFileUpdates = new Map([['file-1', createReadyFile('file-1')]]);
        const { result, rerender } = renderHook(
            ({ updates }) => useFileProcessing(client, 'agent-run-1', updates, toast),
            {
                initialProps: { updates: serverFileUpdates },
            },
        );

        expect(result.current.processingFiles.has('file-1')).toBe(true);

        await act(async () => {
            await result.current.removeProcessingFile('file-1');
        });

        expect(client.agents.sendSignal).toHaveBeenCalledWith('agent-run-1', 'FileRemoved', { id: 'file-1' });
        expect(result.current.processingFiles.has('file-1')).toBe(false);

        rerender({ updates: new Map([['file-1', createReadyFile('file-1')]]) });

        expect(result.current.processingFiles.has('file-1')).toBe(false);
    });

    it('clears files on send without signaling FileRemoved and suppresses the server echo', async () => {
        const client = createClient();
        const toast = vi.fn();
        const serverFileUpdates = new Map([['file-1', createReadyFile('file-1')]]);
        const { result, rerender } = renderHook(
            ({ updates }) => useFileProcessing(client, 'agent-run-1', updates, toast),
            {
                initialProps: { updates: serverFileUpdates },
            },
        );

        expect(result.current.processingFiles.has('file-1')).toBe(true);

        act(() => {
            result.current.clearProcessingFiles();
        });

        // The agent already received the file via FileUploaded, so sending the message
        // consumes it rather than retracting it — no FileRemoved signal.
        expect(client.agents.sendSignal).not.toHaveBeenCalled();
        expect(result.current.processingFiles.has('file-1')).toBe(false);

        // A subsequent server echo for the same file must not re-add the chip.
        rerender({ updates: new Map([['file-1', createReadyFile('file-1')]]) });
        expect(result.current.processingFiles.has('file-1')).toBe(false);
    });

    it('preserves local artifact_path/reference when a server update omits them', async () => {
        const client = createClient();
        const toast = vi.fn();
        const { result, rerender } = renderHook(
            ({ updates }) => useFileProcessing(client, 'agent-run-1', updates, toast),
            {
                initialProps: { updates: new Map<string, ConversationFile>() },
            },
        );

        const file = new File(['pdf'], 'report.pdf', { type: 'application/pdf' });
        await act(async () => {
            await result.current.handleFileUpload([file]);
        });

        const [fileId, local] = Array.from(result.current.processingFiles.entries())[0];
        expect(local.artifact_path).toBe('files/report.pdf');
        expect(local.reference).toBe('artifact:files/report.pdf');

        // Server echoes READY but drops artifact_path/reference — the merge must backfill
        // them from the local optimistic entry so the sent-message embed still resolves.
        rerender({
            updates: new Map<string, ConversationFile>([
                [
                    fileId,
                    {
                        id: fileId,
                        name: 'report.pdf',
                        content_type: 'application/pdf',
                        size: 0,
                        status: FileProcessingStatus.READY,
                        started_at: 1_000,
                    },
                ],
            ]),
        });

        const merged = result.current.processingFiles.get(fileId);
        expect(merged?.status).toBe(FileProcessingStatus.READY);
        expect(merged?.artifact_path).toBe('files/report.pdf');
        expect(merged?.reference).toBe('artifact:files/report.pdf');
    });

    it('does not signal an upload that was removed before upload completion', async () => {
        const client = createClient();
        const uploadArtifact = vi.mocked(client.agents.uploadArtifact);
        let resolveUpload: ((value: AgentArtifactUrlResponse) => void) | undefined;
        uploadArtifact.mockReturnValue(
            new Promise<AgentArtifactUrlResponse>((resolve) => {
                resolveUpload = resolve;
            }),
        );
        const toast = vi.fn();
        const { result } = renderHook(() => useFileProcessing(client, 'agent-run-1', new Map(), toast));
        const file = new File(['image'], 'wrong.png', { type: 'image/png' });
        let uploadPromise: Promise<void> | undefined;

        act(() => {
            uploadPromise = result.current.handleFileUpload([file]);
        });

        await waitFor(() => {
            expect(result.current.processingFiles.size).toBe(1);
        });

        const [fileId] = Array.from(result.current.processingFiles.keys());
        await act(async () => {
            await result.current.removeProcessingFile(fileId);
        });

        await act(async () => {
            resolveUpload?.({ url: 'https://example.test/upload', path: 'files/wrong.png' });
            await uploadPromise;
        });

        expect(client.agents.sendSignal).toHaveBeenCalledWith('agent-run-1', 'FileRemoved', { id: fileId });
        expect(client.agents.sendSignal).not.toHaveBeenCalledWith(
            'agent-run-1',
            'FileUploaded',
            expect.objectContaining({ id: fileId }),
        );
    });

    it('creates and revokes local image preview URLs', async () => {
        const createObjectURL = vi.fn(() => 'blob:wrong');
        const revokeObjectURL = vi.fn();
        vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

        try {
            const client = createClient();
            const toast = vi.fn();
            const { result } = renderHook(() => useFileProcessing(client, 'agent-run-1', new Map(), toast));
            const file = new File(['image'], 'wrong.png', { type: 'image/png' });

            await act(async () => {
                await result.current.handleFileUpload([file]);
            });

            const [fileId, uploadedFile] = Array.from(result.current.processingFiles.entries())[0];
            expect(createObjectURL).toHaveBeenCalledWith(file);
            expect((uploadedFile as ConversationFile & { preview_url?: string }).preview_url).toBe('blob:wrong');

            await act(async () => {
                await result.current.removeProcessingFile(fileId);
            });

            expect(revokeObjectURL).toHaveBeenCalledWith('blob:wrong');
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
