import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOfficePdfConversion } from './useContentPanelHooks';

// The session's client is stable across renders, as in the app; a fresh object per render would restart the poll.
const { getRendition, session } = vi.hoisted(() => {
    const getRendition = vi.fn();
    return { getRendition, session: { client: { objects: { getRendition } } } };
});

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => session,
}));

describe('useOfficePdfConversion', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        getRendition.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('clears the transient error once the PDF is found', async () => {
        getRendition
            .mockRejectedValueOnce(Object.assign(new Error('unavailable'), { status: 503 }))
            .mockResolvedValueOnce({ status: 'found', renditions: ['https://example.test/doc.pdf'] });
        const { result } = renderHook(() => useOfficePdfConversion('obj-1', true));

        act(() => result.current.triggerConversion());
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(result.current.error).toBeTruthy();
        expect(result.current.isConverting).toBe(true);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5_000);
        });
        expect(result.current.pdfUrl).toBe('https://example.test/doc.pdf');
        expect(result.current.error).toBeUndefined();
        expect(result.current.isConverting).toBe(false);
    });
});
