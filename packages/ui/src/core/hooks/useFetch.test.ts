import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFetch } from './useFetch';

describe('useFetch recovery', () => {
    it('clears a previous error when refetching and after success', async () => {
        const fetcher = vi
            .fn<() => Promise<string>>()
            .mockRejectedValueOnce(new Error('Unavailable'))
            .mockResolvedValueOnce('recovered');
        const { result } = renderHook(() => useFetch(fetcher, []));
        await waitFor(() => expect(result.current.error?.message).toBe('Unavailable'));
        await act(async () => {
            await result.current.refetch();
        });
        expect(result.current.error).toBeUndefined();
        expect(result.current.data).toBe('recovered');
        expect(result.current.isLoading).toBe(false);
    });
});
