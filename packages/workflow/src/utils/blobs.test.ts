import fs from 'node:fs';
import { rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { VertesiaClient } from '@vertesia/client';
import tmp from 'tmp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SourceTooLargeError } from '../errors.js';
import { assertBlobSizeWithin, getBlobSize, removeTempFiles, saveBlobToTempFile, withBlobTempFile } from './blobs.js';

// Pass-through, so a test can make the cleanup of a failed download fail.
vi.mock('node:fs/promises', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:fs/promises')>();
    return { ...actual, rm: vi.fn(actual.rm) };
});

function clientReturning(content: string): VertesiaClient {
    return {
        files: { downloadFile: vi.fn(async () => new Blob([content]).stream()) },
    } as unknown as VertesiaClient;
}

function openDescriptorCount(): number {
    // /dev/fd lists this process's open descriptors on both Linux and macOS.
    return fs.readdirSync('/dev/fd').length;
}

let tempDir: string;

beforeEach(() => {
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'blobs-test-')));
    vi.stubEnv('TMPDIR', tempDir);
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('saveBlobToTempFile', () => {
    it('should write the blob to a new file with the requested extension', async () => {
        const file = await saveBlobToTempFile(clientReturning('blob contents'), 'gs://bucket/source', 'pdf');

        expect(path.dirname(file)).toBe(tempDir);
        expect(path.basename(file)).toMatch(/^vertesia-activity-.*\.pdf$/);
        expect(fs.readFileSync(file, 'utf8')).toBe('blob contents');
    });

    it('should accept an extension given with its leading dot', async () => {
        const file = await saveBlobToTempFile(clientReturning('blob contents'), 'gs://bucket/source', '.pdf');

        expect(path.basename(file)).toMatch(/[^.]\.pdf$/);
    });

    it('should not remove an existing file it failed to create', async () => {
        const existing = path.join(tempDir, 'vertesia-activity-existing.pdf');
        fs.writeFileSync(existing, 'someone else');
        vi.spyOn(tmp, 'tmpNameSync').mockReturnValueOnce(existing);
        const client = clientReturning('blob contents');

        await expect(saveBlobToTempFile(client, 'gs://bucket/source', 'pdf')).rejects.toThrow('EEXIST');

        expect(fs.readFileSync(existing, 'utf8')).toBe('someone else');
        expect(client.files.downloadFile).not.toHaveBeenCalled();
    });

    it('should leave no descriptor open after it returns', async () => {
        const client = clientReturning('blob contents');
        const before = openDescriptorCount();

        const files: string[] = [];
        for (let i = 0; i < 20; i++) {
            files.push(await saveBlobToTempFile(client, 'gs://bucket/source'));
        }

        expect(openDescriptorCount()).toBe(before);
        for (const file of files) {
            fs.rmSync(file);
        }
        expect(fs.readdirSync(tempDir)).toEqual([]);
    });

    it('should leave no file or descriptor behind when the blob download fails', async () => {
        const client = {
            files: { downloadFile: vi.fn().mockRejectedValue(new Error('download failed')) },
        } as unknown as VertesiaClient;
        const before = openDescriptorCount();

        await expect(saveBlobToTempFile(client, 'gs://bucket/source')).rejects.toThrow(
            'Failed to download blob gs://bucket/source: download failed',
        );

        expect(openDescriptorCount()).toBe(before);
        expect(fs.readdirSync(tempDir)).toEqual([]);
    });

    it('should preserve the download failure when removing the file also fails', async () => {
        const client = {
            files: { downloadFile: vi.fn().mockRejectedValue(new Error('download failed')) },
        } as unknown as VertesiaClient;
        vi.mocked(rm).mockRejectedValueOnce(new Error('cleanup failed'));

        await expect(saveBlobToTempFile(client, 'gs://bucket/source')).rejects.toThrow(
            'Failed to download blob gs://bucket/source: download failed',
        );
    });

    it('should remove the partial file when the blob stream fails mid-download', async () => {
        const client = {
            files: {
                downloadFile: vi.fn(
                    async () =>
                        new ReadableStream<Uint8Array>({
                            start(controller) {
                                controller.enqueue(new TextEncoder().encode('partial'));
                            },
                            // Fail only once the first chunk is on disk, so the cleanup has a partial file to remove.
                            async pull(controller) {
                                await vi.waitFor(() => {
                                    const [file] = fs.readdirSync(tempDir);
                                    expect(fs.readFileSync(path.join(tempDir, file), 'utf8')).toBe('partial');
                                });
                                controller.error(new Error('stream broke'));
                            },
                        }),
                ),
            },
        } as unknown as VertesiaClient;
        const before = openDescriptorCount();

        await expect(saveBlobToTempFile(client, 'gs://bucket/source')).rejects.toThrow('stream broke');

        expect(openDescriptorCount()).toBe(before);
        expect(fs.readdirSync(tempDir)).toEqual([]);
    });
});

describe('withBlobTempFile', () => {
    it('should hand the downloaded file to the callback and return its result', async () => {
        const result = await withBlobTempFile(
            clientReturning('blob contents'),
            'gs://bucket/source',
            '.pdf',
            (file) => {
                expect(path.extname(file)).toBe('.pdf');
                return fs.promises.readFile(file, 'utf8');
            },
        );

        expect(result).toBe('blob contents');
        expect(fs.readdirSync(tempDir)).toEqual([]);
    });

    it('should remove the work directory and the files written into it when the callback fails', async () => {
        const before = openDescriptorCount();

        await expect(
            withBlobTempFile(clientReturning('blob contents'), 'gs://bucket/source', 'pdf', async (_file, dir) => {
                fs.writeFileSync(path.join(dir, 'output.txt'), 'output');
                throw new Error('callback failed');
            }),
        ).rejects.toThrow('callback failed');

        expect(openDescriptorCount()).toBe(before);
        expect(fs.readdirSync(tempDir)).toEqual([]);
    });

    it('should not run the callback and should leave nothing behind when the download fails', async () => {
        const client = {
            files: { downloadFile: vi.fn().mockRejectedValue(new Error('download failed')) },
        } as unknown as VertesiaClient;
        const fn = vi.fn();

        await expect(withBlobTempFile(client, 'gs://bucket/source', 'pdf', fn)).rejects.toThrow('download failed');

        expect(fn).not.toHaveBeenCalled();
        expect(fs.readdirSync(tempDir)).toEqual([]);
    });
});

describe('removeTempFiles', () => {
    it('should remove files and directories and skip missing or undefined paths', async () => {
        const file = path.join(tempDir, 'file.txt');
        const dir = path.join(tempDir, 'dir');
        fs.writeFileSync(file, 'file');
        fs.mkdirSync(dir);
        fs.writeFileSync(path.join(dir, 'nested.txt'), 'nested');

        await removeTempFiles(file, dir, undefined, path.join(tempDir, 'missing'));

        expect(fs.readdirSync(tempDir)).toEqual([]);
    });

    it('should log a failure outside an activity instead of throwing', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        vi.mocked(rm).mockRejectedValueOnce(new Error('cleanup failed'));

        await expect(removeTempFiles('/tmp/some-file')).resolves.toBeUndefined();

        expect(warn).toHaveBeenCalledWith('Failed to remove temporary file', {
            path: '/tmp/some-file',
            error: 'cleanup failed',
        });
    });
});

describe('blob size limits', () => {
    function clientWith(content: string, size: number | Error | undefined): VertesiaClient {
        return {
            files: {
                downloadFile: vi.fn(async () => new Blob([content]).stream()),
                getMetadata: vi.fn(async () => {
                    if (size instanceof Error) {
                        throw size;
                    }
                    return { name: 'source', contentType: 'application/octet-stream', size };
                }),
            },
        } as unknown as VertesiaClient;
    }

    it('reads the size the store reports, without downloading', async () => {
        const client = clientWith('12345', 5);

        await expect(getBlobSize(client, 'gs://bucket/source')).resolves.toBe(5);
        expect(client.files.downloadFile).not.toHaveBeenCalled();
    });

    it('reports no size for a signed URL, or when the store fails', async () => {
        const signed = clientWith('12345', 5);
        await expect(getBlobSize(signed, 'https://storage.example/source?sig=x')).resolves.toBeUndefined();
        expect(signed.files.getMetadata).not.toHaveBeenCalled();

        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        await expect(getBlobSize(clientWith('12345', new Error('boom')), 'gs://b/s')).resolves.toBeUndefined();
    });

    it('fails a blob the store reports over the limit, and passes one of unknown size', async () => {
        await expect(assertBlobSizeWithin(clientWith('', 11), 'gs://b/s', 10)).rejects.toMatchObject({
            type: 'SourceTooLargeError',
            nonRetryable: true,
            size: 11,
            maxBytes: 10,
        });
        await expect(assertBlobSizeWithin(clientWith('', 10), 'gs://b/s', 10)).resolves.toBeUndefined();
        await expect(assertBlobSizeWithin(clientWith('', undefined), 'gs://b/s', 10)).resolves.toBeUndefined();
    });

    it('fails before downloading anything when the store reports the blob over the limit', async () => {
        const client = clientWith('x'.repeat(100), 100);

        await expect(saveBlobToTempFile(client, 'gs://bucket/source', 'mxf', { maxBytes: 99 })).rejects.toBeInstanceOf(
            SourceTooLargeError,
        );

        expect(client.files.downloadFile).not.toHaveBeenCalled();
        expect(fs.readdirSync(tempDir)).toEqual([]);
    });

    it('stops a download of unknown size once it goes over the limit, and removes the partial file', async () => {
        const before = openDescriptorCount();
        for (const size of [undefined, 1]) {
            // A store that under-reports the size is caught by the download cap too.
            const client = clientWith('x'.repeat(100), size);

            await expect(
                withBlobTempFile(client, 'gs://b/s', 'mxf', async () => 'used', { maxBytes: 99 }),
            ).rejects.toBeInstanceOf(SourceTooLargeError);
            await expect(saveBlobToTempFile(client, 'gs://b/s', 'mxf', { maxBytes: 99 })).rejects.toBeInstanceOf(
                SourceTooLargeError,
            );
        }
        expect(openDescriptorCount()).toBe(before);
        expect(fs.readdirSync(tempDir)).toEqual([]);
    });

    it('downloads a blob of exactly the limit', async () => {
        const client = clientWith('x'.repeat(100), undefined);

        const content = await withBlobTempFile(
            client,
            'gs://b/s',
            'txt',
            (file) => fs.promises.readFile(file, 'utf8'),
            {
                maxBytes: 100,
            },
        );

        expect(content).toBe('x'.repeat(100));
    });
});
