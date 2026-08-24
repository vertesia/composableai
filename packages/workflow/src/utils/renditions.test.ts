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
