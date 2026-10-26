import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { log } from '@temporalio/activity';
import type { VertesiaClient } from '@vertesia/client';
import { ImageRenditionFormat } from '@vertesia/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { imageResizer } from '../conversion/image.js';
import { ImageConversionError } from '../errors.js';
import { uploadRenditionPages } from './renditions.js';
import { createUploadStream } from './upload-stream.js';

const activityState = vi.hoisted(() => ({ aborted: false }));

vi.mock('@temporalio/activity', () => ({
    Context: {
        current: () => ({ cancellationSignal: { aborted: activityState.aborted } }),
    },
    log: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

vi.mock('../conversion/image.js', () => ({ imageResizer: vi.fn() }));

vi.mock('./upload-stream.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./upload-stream.js')>();
    return { ...actual, createUploadStream: vi.fn(actual.createUploadStream) };
});

describe('uploadRenditionPages', () => {
    let tempDir: string;
    let resizedImagePath: string;

    beforeEach(() => {
        vi.clearAllMocks();
        activityState.aborted = false;
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'renditions-test-'));
        resizedImagePath = path.join(tempDir, 'resized.jpeg');
        fs.writeFileSync(resizedImagePath, 'resized');
    });

    afterEach(() => {
        vi.restoreAllMocks();
        fs.rmSync(tempDir, { recursive: true, force: true });
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
        const uploadError = new Error('upload failed');
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

        expect(fs.existsSync(resizedImagePath)).toBe(false);
        // The upload never read the stream; it must be closed so the removed file's descriptor is released.
        const [stream] = vi.mocked(createUploadStream).mock.results;
        expect((stream.value as fs.ReadStream).closed).toBe(true);
        expect(log.error).toHaveBeenCalledWith('Failed to upload rendition for etag page 0', { error: uploadError });
    });

    it('should log an upload aborted by a stopping activity at info, not error', async () => {
        activityState.aborted = true;
        const shutdownError = new Error('Failed to connect to server: WORKER_SHUTDOWN');
        vi.mocked(imageResizer).mockResolvedValue(resizedImagePath);
        const client = {
            files: { uploadFile: vi.fn().mockRejectedValue(shutdownError) },
        } as unknown as VertesiaClient;

        await expect(
            uploadRenditionPages(client, 'etag', ['/tmp/input'], {
                format: ImageRenditionFormat.jpeg,
                max_hw: 256,
            }),
        ).rejects.toBe(shutdownError);

        expect(log.error).not.toHaveBeenCalled();
        expect(log.info).toHaveBeenCalledWith(
            'Rendition upload for etag page 0 interrupted: the activity is stopping',
            { error: shutdownError },
        );
    });
});
