import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBrowserFileUrl } from './useBrowserFileUrl.js';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('useBrowserFileUrl', () => {
    it('returns a signed URL without fetching it', async () => {
        const files = { fetchDownloadUrl: vi.fn() };
        const { result } = renderHook(() => useBrowserFileUrl(files, 'first'));
        await expect(result.current({ url: 'https://storage.example/signed' })).resolves.toBe(
            'https://storage.example/signed',
        );
        expect(files.fetchDownloadUrl).not.toHaveBeenCalled();
    });

    it('uses the authenticated reader for tickets, makes HTML inert and releases the file when the source changes', async () => {
        const create = vi.fn().mockReturnValue('blob:preview');
        const revoke = vi.fn();
        vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: create, revokeObjectURL: revoke }));
        const files = { fetchDownloadUrl: vi.fn().mockResolvedValue(new Response('<script></script>')) };
        const { result, rerender } = renderHook(({ id }) => useBrowserFileUrl(files, id), {
            initialProps: { id: 'first' },
        });
        await expect(
            result.current({ url: '/ticket', authentication_required: true, mime_type: 'text/html' }),
        ).resolves.toBe('blob:preview');
        expect(files.fetchDownloadUrl).toHaveBeenCalledWith('/ticket');
        expect(create.mock.calls[0][0].type).toBe('application/octet-stream');
        rerender({ id: 'second' });
        expect(revoke).toHaveBeenCalledWith('blob:preview');
    });

    it('discards a response arriving after unmount', async () => {
        const files = { fetchDownloadUrl: vi.fn().mockResolvedValue(new Response('image')) };
        const { result, unmount } = renderHook(() => useBrowserFileUrl(files, 'first'));
        const resolved = result.current({ url: '/ticket', authentication_required: true });
        unmount();
        await expect(resolved).rejects.toMatchObject({ name: 'AbortError' });
    });
});
