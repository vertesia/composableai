import type { VertesiaClient } from '@vertesia/client';
import tmp from 'tmp';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveBlobToTempFile } from './blobs.js';

vi.mock('tmp', () => ({
    default: {
        fileSync: vi.fn(),
        setGracefulCleanup: vi.fn(),
    },
}));

describe('saveBlobToTempFile', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should remove the temporary file when the blob download fails', async () => {
        const removeCallback = vi.fn();
        vi.mocked(tmp.fileSync).mockReturnValue({
            name: '/tmp/failed-download',
            fd: 1,
            removeCallback,
        });
        const downloadError = new Error('download failed');
        const client = {
            files: { downloadFile: vi.fn().mockRejectedValue(downloadError) },
        } as unknown as VertesiaClient;

        await expect(saveBlobToTempFile(client, 'gs://bucket/source')).rejects.toThrow('download failed');

        expect(removeCallback).toHaveBeenCalledOnce();
    });

    it('should preserve the download failure when temporary-file cleanup also fails', async () => {
        const downloadError = new Error('download failed');
        vi.mocked(tmp.fileSync).mockReturnValue({
            name: '/tmp/failed-download',
            fd: 1,
            removeCallback: vi.fn(() => {
                throw new Error('cleanup failed');
            }),
        });
        const client = {
            files: { downloadFile: vi.fn().mockRejectedValue(downloadError) },
        } as unknown as VertesiaClient;

        await expect(saveBlobToTempFile(client, 'gs://bucket/source')).rejects.toThrow(
            'Failed to download blob gs://bucket/source: download failed',
        );
    });
});
