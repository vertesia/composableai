import { renderHook, waitFor } from '@testing-library/react';
import type { VertesiaClient } from '@vertesia/client';
import { describe, expect, it, vi } from 'vitest';
import { useArtifacts } from './useArtifacts';

function createClient(listArtifacts: (runId: string) => Promise<string[]>) {
    return {
        files: { listArtifacts: vi.fn(listArtifacts) },
    } as unknown as VertesiaClient;
}

describe('useArtifacts', () => {
    it('clears files when the run goes away', async () => {
        const client = createClient(async (runId) => [`agents/${runId}/files/report.csv`]);

        const { result, rerender } = renderHook(({ runId }) => useArtifacts(client, runId), {
            initialProps: { runId: 'run-a' as string | undefined },
        });

        await waitFor(() => expect(result.current.flatFiles).toEqual(['files/report.csv']));

        rerender({ runId: undefined });

        await waitFor(() => expect(result.current.flatFiles).toEqual([]));
        expect(result.current.totalCount).toBe(0);
        expect(result.current.isLoading).toBe(false);
    });

    it('clears a previous run error when the run goes away', async () => {
        const client = createClient(async () => {
            throw new Error('boom');
        });

        const { result, rerender } = renderHook(({ runId }) => useArtifacts(client, runId), {
            initialProps: { runId: 'run-a' as string | undefined },
        });

        await waitFor(() => expect(result.current.error).toBe('boom'));

        rerender({ runId: undefined });

        await waitFor(() => expect(result.current.error).toBeNull());
    });

    it('does not let a late response from the previous run repopulate after it is cleared', async () => {
        let release: (paths: string[]) => void = () => {};
        const client = createClient(
            () =>
                new Promise<string[]>((resolve) => {
                    release = resolve;
                }),
        );

        const { result, rerender } = renderHook(({ runId }) => useArtifacts(client, runId), {
            initialProps: { runId: 'run-a' as string | undefined },
        });

        rerender({ runId: undefined });
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // The run-a listing only now comes back.
        release(['agents/run-a/files/late.csv']);

        await waitFor(() => expect(result.current.flatFiles).toEqual([]));
    });

    it('swaps to the new run rather than merging with the previous one', async () => {
        const client = createClient(async (runId) => [`agents/${runId}/files/${runId}.csv`]);

        const { result, rerender } = renderHook(({ runId }) => useArtifacts(client, runId), {
            initialProps: { runId: 'run-a' as string | undefined },
        });

        await waitFor(() => expect(result.current.flatFiles).toEqual(['files/run-a.csv']));

        rerender({ runId: 'run-b' });

        await waitFor(() => expect(result.current.flatFiles).toEqual(['files/run-b.csv']));
    });
});
