import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@temporalio/activity', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/**
 * What the stand-in markitdown does when it runs: wait for `gate` if set, then write this output, or fail with this
 * error.
 */
const tool = vi.hoisted(() => ({
    output: 'converted text',
    error: undefined as Error | undefined,
    gate: undefined as Promise<void> | undefined,
}));

vi.mock('../activities/media/exec.js', () => ({
    execActivityFile: vi.fn(async (_tool: string, args: string[]) => {
        await tool.gate;
        if (tool.error) {
            throw tool.error;
        }
        fs.writeFileSync(args[args.indexOf('-o') + 1], tool.output);
        return { stdout: '', stderr: '' };
    }),
}));

const prlimit = vi.hoisted(() => ({ path: undefined as string | undefined }));

vi.mock('./prlimit.js', () => ({ findPrlimit: () => prlimit.path }));

const zip = vi.hoisted(() => ({
    entries: [] as { name: string; uncompressedSize: number; compressionMethod: number }[],
}));

vi.mock('./office-zip.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./office-zip.js')>()),
    readZipEntries: vi.fn(async () => zip.entries),
}));

import { execActivityFile } from '../activities/media/exec.js';
import { DocumentConversionError, SourceTooLargeError } from '../errors.js';
import {
    OFFICE_MAX_CONCURRENT_ENV,
    OFFICE_MAX_MEMORY_MB_ENV,
    OFFICE_MAX_PARSED_MB_ENV,
    OFFICE_MAX_UNPACKED_MB_ENV,
} from '../utils/source-limits.js';
import { markdownWithMarkitdown, officeSize, ranOutOfMemory, rejectionReason } from './markitdown.js';
import { InvalidZipError, readZipEntries } from './office-zip.js';

const MiB = 1024 * 1024;

/** An error as execFile rejects with when the process exits with `code`, or is killed by `signal`. */
function execError(stderr: string, code: number | null, signal: string | null = null): Error {
    return Object.assign(new Error(`Command failed: markitdown\n${stderr}`), { code, signal, stderr, stdout: '' });
}

/** stderr of markitdown 0.1 for a file that is not a zip. */
const STDERR_0_1 = `Traceback (most recent call last):
  File "/usr/local/bin/markitdown", line 8, in <module>
    sys.exit(main())
  File "/opt/markitdown/lib/python3.13/site-packages/markitdown/_markitdown.py", line 612, in _convert
    raise FileConversionException(attempts=failed_attempts)
markitdown._exceptions.FileConversionException: File conversion failed after 1 attempts:
 - DocxConverter threw BadZipFile with message: File is not a zip file
`;

/** stderr of markitdown 0.1 when a converter raised `cause`. */
function stderrWrapping(cause: string, message: string): string {
    return `Traceback (most recent call last):
  File "/opt/markitdown/lib/python3.13/site-packages/markitdown/_markitdown.py", line 612, in _convert
    raise FileConversionException(attempts=failed_attempts)
markitdown._exceptions.FileConversionException: File conversion failed after 1 attempts:
 - PptxConverter threw ${cause} with message: ${message}
`;
}

/** stderr of markitdown 0.0, which chains the underlying traceback. */
const STDERR_0_0 = `Traceback (most recent call last):
  File "/x/markitdown/_markitdown.py", line 1731, in _convert
    raise FileConversionException(
markitdown._markitdown.FileConversionException: Could not convert '/tmp/blob.docx' to Markdown.

Traceback (most recent call last):
  File "/x/zipfile/__init__.py", line 1572, in _RealGetContents
    raise BadZipFile("File is not a zip file")
zipfile.BadZipFile: File is not a zip file
`;

describe('markdownWithMarkitdown', () => {
    let tempDir: string;
    let input: string;

    beforeEach(() => {
        tool.output = 'converted text';
        tool.error = undefined;
        tool.gate = undefined;
        prlimit.path = undefined;
        zip.entries = [{ name: 'word/document.xml', uncompressedSize: 1000, compressionMethod: 8 }];
        vi.mocked(execActivityFile).mockClear();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markitdown-test-'));
        input = path.join(tempDir, 'blob.docx');
        fs.writeFileSync(input, 'zip');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should convert the file at its path and leave it in place', async () => {
        await expect(markdownWithMarkitdown(input, 'docx')).resolves.toBe('converted text');

        const [command, args] = vi.mocked(execActivityFile).mock.calls[0];
        expect(command).toBe('markitdown');
        expect(args?.[0]).toBe(input);
        expect(fs.readdirSync(tempDir)).toEqual(['blob.docx']);
    });

    it('should read no more of the output than asked', async () => {
        tool.output = 'x'.repeat(100);

        await expect(markdownWithMarkitdown(input, 'docx', { maxOutputBytes: 10 })).resolves.toBe('x'.repeat(10));
    });

    it('should give markitdown only the allowed environment variables', async () => {
        vi.stubEnv('VERTESIA_TEST_SECRET', 'secret');
        vi.stubEnv('TMPDIR', tempDir);

        await markdownWithMarkitdown(input, 'docx');

        const options = vi.mocked(execActivityFile).mock.calls[0][2];
        expect(options?.env).toMatchObject({ TMPDIR: tempDir });
        expect(options?.env).not.toHaveProperty('VERTESIA_TEST_SECRET');
        expect(options?.env).toMatchObject({ MALLOC_ARENA_MAX: '2', OMP_NUM_THREADS: '1' });
        expect(
            Object.keys(options?.env ?? {}).every((name) =>
                /^(PATH|HOME|TMPDIR|LANG|LC_\w+|TZ|MALLOC_ARENA_MAX|OMP_NUM_THREADS)$/.test(name),
            ),
        ).toBe(true);
    });

    it('should run markitdown under its memory limit where prlimit is available', async () => {
        prlimit.path = '/usr/bin/prlimit';
        vi.stubEnv(OFFICE_MAX_MEMORY_MB_ENV, '512');

        await markdownWithMarkitdown(input, 'docx');

        const [command, args] = vi.mocked(execActivityFile).mock.calls[0];
        expect(command).toBe('/usr/bin/prlimit');
        expect(args?.slice(0, 4)).toEqual([`--as=${512 * MiB}`, 'markitdown', input, '-o']);
    });

    it('should refuse a document that runs out of the memory limit, and not retry it', async () => {
        prlimit.path = '/usr/bin/prlimit';
        tool.error = execError(stderrWrapping('MemoryError', ''), 1);

        const result = markdownWithMarkitdown(input, 'docx', { source: 'gs://bucket/doc.docx' });

        await expect(result).rejects.toBeInstanceOf(SourceTooLargeError);
        await expect(result).rejects.toMatchObject({ source: 'gs://bucket/doc.docx', maxBytes: 1536 * MiB });
    });

    it('should let a retry run on a MemoryError when markitdown had no limit of its own', async () => {
        const error = execError(stderrWrapping('MemoryError', ''), 1);
        tool.error = error;

        await expect(markdownWithMarkitdown(input, 'docx')).rejects.toBe(error);
    });

    it('should run one conversion at a time by default', async () => {
        let open = (): void => undefined;
        tool.gate = new Promise((resolve) => {
            open = resolve;
        });

        const first = markdownWithMarkitdown(input, 'docx');
        const second = markdownWithMarkitdown(input, 'docx');
        await vi.waitFor(() => expect(execActivityFile).toHaveBeenCalledTimes(1));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(execActivityFile).toHaveBeenCalledTimes(1);

        open();
        await expect(Promise.all([first, second])).resolves.toEqual(['converted text', 'converted text']);
        expect(execActivityFile).toHaveBeenCalledTimes(2);
    });

    it('should run as many conversions at once as configured', async () => {
        vi.stubEnv(OFFICE_MAX_CONCURRENT_ENV, '2');
        let open = (): void => undefined;
        tool.gate = new Promise((resolve) => {
            open = resolve;
        });

        const both = Promise.all([markdownWithMarkitdown(input, 'docx'), markdownWithMarkitdown(input, 'docx')]);
        await vi.waitFor(() => expect(execActivityFile).toHaveBeenCalledTimes(2));

        open();
        await both;
    });

    it('should free its slot when a conversion fails', async () => {
        tool.error = execError(STDERR_0_1, 1);
        await expect(markdownWithMarkitdown(input, 'docx')).rejects.toBeInstanceOf(DocumentConversionError);

        tool.error = undefined;
        await expect(markdownWithMarkitdown(input, 'docx')).resolves.toBe('converted text');
    });

    it('should refuse a part compressed by a method Office does not write, without running markitdown', async () => {
        zip.entries = [{ name: 'word/document.xml', uncompressedSize: 1000, compressionMethod: 12 }];

        const result = markdownWithMarkitdown(input, 'docx', { source: 'gs://bucket/doc.docx' });

        await expect(result).rejects.toBeInstanceOf(DocumentConversionError);
        await expect(result).rejects.toThrow('word/document.xml uses zip compression method 12');
        expect(execActivityFile).not.toHaveBeenCalled();
    });

    it('should refuse a document over the parse limit without running markitdown', async () => {
        vi.stubEnv(OFFICE_MAX_PARSED_MB_ENV, '1');
        zip.entries = [{ name: 'word/document.xml', uncompressedSize: 2 * MiB, compressionMethod: 8 }];

        const result = markdownWithMarkitdown(input, 'docx', { source: 'gs://bucket/doc.docx' });

        await expect(result).rejects.toBeInstanceOf(SourceTooLargeError);
        await expect(result).rejects.toMatchObject({ source: 'gs://bucket/doc.docx', maxBytes: MiB, size: 2 * MiB });
        expect(execActivityFile).not.toHaveBeenCalled();
    });

    it('should refuse a PPTX whose media unpack over the limit without running markitdown', async () => {
        vi.stubEnv(OFFICE_MAX_UNPACKED_MB_ENV, '1');
        zip.entries = [
            { name: 'ppt/slides/slide1.xml', uncompressedSize: 1000, compressionMethod: 8 },
            { name: 'ppt/media/video1.mp4', uncompressedSize: 2 * MiB, compressionMethod: 0 },
        ];

        const result = markdownWithMarkitdown(input, 'pptx', { source: 'gs://bucket/deck.pptx' });

        await expect(result).rejects.toBeInstanceOf(SourceTooLargeError);
        await expect(result).rejects.toMatchObject({ maxBytes: MiB, size: 2 * MiB + 1000 });
        expect(execActivityFile).not.toHaveBeenCalled();
    });

    it('should refuse a file that is not a zip without running markitdown, and not retry it', async () => {
        vi.mocked(readZipEntries).mockRejectedValueOnce(new InvalidZipError('No zip end of central directory record'));

        const result = markdownWithMarkitdown(input, 'docx', { source: 'gs://bucket/doc.docx' });

        await expect(result).rejects.toBeInstanceOf(DocumentConversionError);
        await expect(result).rejects.toMatchObject({ nonRetryable: true });
        await expect(result).rejects.toThrow('gs://bucket/doc.docx is not a valid DOCX file');
        expect(execActivityFile).not.toHaveBeenCalled();
    });

    it('should not retry a document markitdown rejects', async () => {
        tool.error = execError(STDERR_0_1, 1);

        const result = markdownWithMarkitdown(input, 'pptx', { source: 'gs://bucket/deck.pptx' });

        await expect(result).rejects.toBeInstanceOf(DocumentConversionError);
        await expect(result).rejects.toMatchObject({ nonRetryable: true });
        await expect(result).rejects.toThrow(
            'markitdown cannot convert the PPTX gs://bucket/deck.pptx: markitdown._exceptions.FileConversionException',
        );
    });

    it.each([
        { name: 'killed', error: execError('', null, 'SIGKILL') },
        { name: 'crashed', error: execError('Segmentation fault', 139) },
        { name: 'failed on its own bug', error: execError('Traceback ...\nKeyError: x', 1) },
        { name: 'out of memory in a converter', error: execError(stderrWrapping('MemoryError', ''), 1) },
        { name: 'failing to read a file', error: execError(stderrWrapping('OSError', '[Errno 5] I/O error'), 1) },
    ])('should let a retry run when markitdown is $name', async ({ error }) => {
        tool.error = error;

        await expect(markdownWithMarkitdown(input, 'docx')).rejects.toBe(error);
    });
});

describe('officeSize', () => {
    const entries = [
        { name: '[Content_Types].xml', uncompressedSize: 1, compressionMethod: 8 },
        { name: 'word/_rels/document.xml.rels', uncompressedSize: 10, compressionMethod: 8 },
        { name: 'word/document.xml', uncompressedSize: 100, compressionMethod: 8 },
        { name: 'word/media/image1.png', uncompressedSize: 1000, compressionMethod: 0 },
    ];

    it('should count every part of a DOCX as parsed, since mammoth inlines its images', () => {
        expect(officeSize('docx', entries)).toEqual({ parsed: 1111, unpacked: 1111 });
    });

    it('should count only the XML parts of a PPTX as parsed, and every part as unpacked', () => {
        expect(officeSize('pptx', entries)).toEqual({ parsed: 111, unpacked: 1111 });
    });
});

describe('rejectionReason', () => {
    it('should quote the exception and the error under it, from markitdown 0.1', () => {
        expect(rejectionReason(execError(STDERR_0_1, 1))).toBe(
            'markitdown._exceptions.FileConversionException: File conversion failed after 1 attempts: ' +
                '- DocxConverter threw BadZipFile with message: File is not a zip file',
        );
    });

    it('should quote the exception and the error under it, from markitdown 0.0', () => {
        expect(rejectionReason(execError(STDERR_0_0, 1))).toBe(
            "markitdown._markitdown.FileConversionException: Could not convert '/tmp/blob.docx' to Markdown. " +
                'zipfile.BadZipFile: File is not a zip file',
        );
    });

    it.each(['XMLSyntaxError', 'PackageNotFoundError'])('should recognize a converter that raised %s', (cause) => {
        expect(rejectionReason(execError(stderrWrapping(cause, 'bad'), 1))).toContain(`threw ${cause} with message`);
    });

    it('should not reject a document when one of the converters failed for another cause', () => {
        const stderr = stderrWrapping('BadZipFile', 'Bad CRC-32').replace(
            ' - PptxConverter',
            ' - DocxConverter threw MemoryError with message: \n - PptxConverter',
        );
        expect(rejectionReason(execError(stderr, 1))).toBeUndefined();
    });

    it('should recognize an unsupported format', () => {
        expect(
            rejectionReason(execError('markitdown._exceptions.UnsupportedFormatException: No converter for .docx', 1)),
        ).toBe('markitdown._exceptions.UnsupportedFormatException: No converter for .docx');
    });

    it.each([
        { name: 'another exit code', error: execError(STDERR_0_1, 2) },
        { name: 'a kill', error: execError(STDERR_0_1, null, 'SIGKILL') },
        { name: 'another exception', error: execError('MemoryError', 1) },
        { name: 'a wrapped MemoryError', error: execError(stderrWrapping('MemoryError', ''), 1) },
        { name: 'a wrapped OSError', error: execError(stderrWrapping('OSError', '[Errno 28] No space left'), 1) },
        { name: 'an error without stderr', error: new Error('spawn markitdown ENOENT') },
        { name: 'a non-error', error: 'markitdown failed' },
    ])('should not classify $name as a rejection', ({ error }) => {
        expect(rejectionReason(error)).toBeUndefined();
    });
});

describe('ranOutOfMemory', () => {
    it('should recognize a MemoryError a converter raised', () => {
        expect(ranOutOfMemory(execError(stderrWrapping('MemoryError', ''), 1))).toBe(true);
    });

    it('should recognize a MemoryError raised outside the converters', () => {
        expect(ranOutOfMemory(execError('Traceback (most recent call last):\nMemoryError', 1))).toBe(true);
    });

    it.each([
        { name: 'an input error', error: execError(STDERR_0_1, 1) },
        { name: 'a kill', error: execError('', null, 'SIGKILL') },
        { name: 'a non-error', error: 'MemoryError' },
    ])('should not report $name', ({ error }) => {
        expect(ranOutOfMemory(error)).toBe(false);
    });
});
