import { renderHook, waitFor } from '@testing-library/react';
import type { VertesiaClient } from '@vertesia/client';
import { type AgentRunFile, type AgentRunFilesResponse, FileProcessingStatus } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { useAttachmentPreparation } from './useAttachmentPreparation';

function file(name: string, status: FileProcessingStatus): AgentRunFile {
    return {
        id: name,
        name,
        content_type: 'application/pdf',
        artifact_path: `files/${name}`,
        started_at: 1_000,
        status,
    };
}

function createClient(responses: AgentRunFilesResponse[]) {
    const getFiles = vi.fn();
    for (const response of responses) getFiles.mockResolvedValueOnce(response);
    getFiles.mockResolvedValue(responses[responses.length - 1]);
    return { client: { agents: { getFiles } } as unknown as VertesiaClient, getFiles };
}

describe('useAttachmentPreparation', () => {
    it('says how many attachments are ready and which are still being read', async () => {
        const { client } = createClient([
            {
                files: [file('a.pdf', FileProcessingStatus.READY), file('b.docx', FileProcessingStatus.PROCESSING)],
                settled: false,
            },
        ]);

        const { result } = renderHook(() => useAttachmentPreparation(client, 'run-1', true));

        await waitFor(() => {
            expect(result.current).toBe('1 of 2 attachments ready — still reading b.docx');
        });
    });

    it('goes quiet and stops asking once every attachment has settled', async () => {
        const { client, getFiles } = createClient([
            { files: [file('a.pdf', FileProcessingStatus.PROCESSING)], settled: false },
            { files: [file('a.pdf', FileProcessingStatus.READY)], settled: true },
        ]);

        const { result } = renderHook(() => useAttachmentPreparation(client, 'run-1', true));

        await waitFor(() => expect(result.current).toBeDefined());
        // Longer than one poll interval, which is what has to elapse before the second read.
        await waitFor(() => expect(result.current).toBeUndefined(), { timeout: 4_000 });

        const callsWhenSettled = getFiles.mock.calls.length;
        await new Promise((resolve) => setTimeout(resolve, 60));
        // A settled run must not keep polling for as long as the agent works.
        expect(getFiles.mock.calls.length).toBe(callsWhenSettled);
    });

    it('says nothing for a run started without attachments', async () => {
        const { client } = createClient([{ files: [], settled: true }]);

        const { result } = renderHook(() => useAttachmentPreparation(client, 'run-1', true));

        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(result.current).toBeUndefined();
    });

    it('keeps the generic label when the run cannot be read', async () => {
        const getFiles = vi.fn().mockRejectedValue(new Error('boom'));
        const client = { agents: { getFiles } } as unknown as VertesiaClient;

        const { result } = renderHook(() => useAttachmentPreparation(client, 'run-1', true));

        await waitFor(() => expect(getFiles).toHaveBeenCalled());
        expect(result.current).toBeUndefined();
    });

    it('does not ask at all while the agent is not working', async () => {
        const { client, getFiles } = createClient([{ files: [], settled: true }]);

        renderHook(() => useAttachmentPreparation(client, 'run-1', false));

        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(getFiles).not.toHaveBeenCalled();
    });
});
