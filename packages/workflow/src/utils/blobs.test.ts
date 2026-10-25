import fs from 'node:fs';
import { rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { VertesiaClient } from '@vertesia/client';
import tmp from 'tmp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { removeTempFiles, saveBlobToTempFile, withBlobTempFile } from './blobs.js';

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
