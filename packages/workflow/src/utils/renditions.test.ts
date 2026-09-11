import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { VertesiaClient } from '@vertesia/client';
import { ImageRenditionFormat } from '@vertesia/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { imageResizer } from '../conversion/image.js';
import { ImageConversionError } from '../errors.js';
import { uploadRenditionPages } from './renditions.js';

vi.mock('@temporalio/activity', () => ({
    log: {
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

vi.mock('../conversion/image.js', () => ({ imageResizer: vi.fn() }));

describe('uploadRenditionPages', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should wait for running pages, skip queued pages, and preserve the first failure', async () => {
        const first = Promise.withResolvers<string>();
        const second = Promise.withResolvers<string>();
        const firstError = new ImageConversionError('second page failed first');
        vi.mocked(imageResizer).mockImplementation((input) => (input === 'first' ? first.promise : second.promise));
        const client = { files: { uploadFile: vi.fn() } } as unknown as VertesiaClient;
        const result = uploadRenditionPages(
            client,
            'etag',
            ['first', 'second', 'queued'],
            {
                format: ImageRenditionFormat.jpeg,
                max_hw: 256,
            },
            2,
        );
        let settled = false;
        void result.then(
            () => {
                settled = true;
            },
            () => {
                settled = true;
            },
        );
        const assertion = expect(result).rejects.toBe(firstError);

        await vi.waitFor(() => expect(imageResizer).toHaveBeenCalledTimes(2));
        second.reject(firstError);
        // Wait a complete turn so the failure and the queued task have both been handled.
        await new Promise<void>((resolve) => setImmediate(resolve));
        const settledBeforeDrain = settled;
        const startedBeforeDrain = vi.mocked(imageResizer).mock.calls.length;
        first.reject(new Error('first page failed later'));
        await assertion;

        expect(settledBeforeDrain).toBe(false);
        expect(startedBeforeDrain).toBe(2);
        expect(imageResizer).toHaveBeenCalledTimes(2);
        expect(client.files.uploadFile).not.toHaveBeenCalled();
    });

    it('should preserve page ordering when uploads complete out of order', async () => {
        const resizedImagePath = fileURLToPath(import.meta.url);
        vi.spyOn(fs, 'unlinkSync').mockImplementation(() => undefined);
        vi.mocked(imageResizer).mockResolvedValue(resizedImagePath);
        const first = Promise.withResolvers<string>();
        const second = Promise.withResolvers<string>();
        const uploadFile = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const client = { files: { uploadFile } } as unknown as VertesiaClient;
        const result = uploadRenditionPages(client, 'etag', ['first', 'second'], {
            format: ImageRenditionFormat.jpeg,
            max_hw: 256,
        });
        await vi.waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(2));
        second.resolve('second-rendition');
        first.resolve('first-rendition');
        await expect(result).resolves.toEqual(['first-rendition', 'second-rendition']);
    });

    it('should preserve a non-retryable image conversion failure', async () => {
        const conversionError = new ImageConversionError('invalid image data');
        vi.mocked(imageResizer).mockRejectedValue(conversionError);
        const client = { files: { uploadFile: vi.fn() } } as unknown as VertesiaClient;

        await expect(
            uploadRenditionPages(client, 'etag', ['/tmp/input'], {
                format: ImageRenditionFormat.jpeg,
                max_hw: 256,
            }),
        ).rejects.toBe(conversionError);

        expect(client.files.uploadFile).not.toHaveBeenCalled();
    });

    it('should preserve an upload failure and clean the resized image', async () => {
        const resizedImagePath = fileURLToPath(import.meta.url);
        const uploadError = new Error('upload failed');
        const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => undefined);
        vi.mocked(imageResizer).mockResolvedValue(resizedImagePath);
        const client = {
            files: { uploadFile: vi.fn().mockRejectedValue(uploadError) },
        } as unknown as VertesiaClient;

        await expect(
            uploadRenditionPages(client, 'etag', ['/tmp/input'], {
                format: ImageRenditionFormat.jpeg,
                max_hw: 256,
            }),
        ).rejects.toBe(uploadError);

        expect(unlinkSpy).toHaveBeenCalledWith(resizedImagePath);
    });
});
