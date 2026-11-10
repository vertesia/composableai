import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@temporalio/activity', () => ({
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const toolExitCode = vi.hoisted(() => ({ value: 0 }));

// Stand-in for mutool and markitdown: write the `-o` target, or fail like execFile does for a non-zero exit.
vi.mock('../activities/media/exec.js', () => ({
    execActivityFile: vi.fn(async (tool: string, args: string[]) => {
        if (toolExitCode.value !== 0) {
            throw new Error(`Command failed: ${tool} ${args.join(' ')}\nexit code ${toolExitCode.value}`);
        }
        fs.writeFileSync(args[args.indexOf('-o') + 1], 'converted text');
        return { stdout: '', stderr: '' };
    }),
}));

import { execActivityFile } from '../activities/media/exec.js';
import { markdownWithMarkitdown } from './markitdown.js';
import { mutoolPdfToText, pdfExtractPages } from './mutool.js';

function openDescriptorCount(): number {
    // /dev/fd lists this process's open descriptors on both Linux and macOS.
    return fs.readdirSync('/dev/fd').length;
}

describe.each([
    { name: 'mutoolPdfToText', convert: (buffer: Buffer) => mutoolPdfToText(buffer) },
    { name: 'markdownWithMarkitdown', convert: (buffer: Buffer) => markdownWithMarkitdown(buffer, 'docx') },
])('$name temporary files', ({ convert }) => {
    let tempDir: string;

    beforeEach(() => {
        toolExitCode.value = 0;
        tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'conversion-test-')));
        vi.stubEnv('TMPDIR', tempDir);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should return the converted text and leave no file or descriptor behind', async () => {
        const before = openDescriptorCount();

        for (let i = 0; i < 10; i++) {
            await expect(convert(Buffer.from('input'))).resolves.toBe('converted text');
        }

        expect(openDescriptorCount()).toBe(before);
        expect(fs.readdirSync(tempDir)).toEqual([]);
    });

    it('should leave no file or descriptor behind when the tool fails', async () => {
        toolExitCode.value = 1;
        const before = openDescriptorCount();

        await expect(convert(Buffer.from('input'))).rejects.toThrow('Command failed');

        expect(openDescriptorCount()).toBe(before);
        expect(fs.readdirSync(tempDir)).toEqual([]);
    });
});

describe('conversion temporary files', () => {
    let tempDir: string;

    beforeEach(() => {
        toolExitCode.value = 0;
        tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'conversion-test-')));
        vi.stubEnv('TMPDIR', tempDir);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should give markitdown an input file with a dotted extension', async () => {
        await markdownWithMarkitdown(Buffer.from('input'), 'docx');

        const [, args] = vi.mocked(execActivityFile).mock.calls.at(-1) ?? [];
        expect(args?.[0]).toMatch(/[^.]\.docx$/);
    });

    it('should remove the pdfExtractPages work directory when mutool fails', async () => {
        toolExitCode.value = 1;

        await expect(pdfExtractPages(Buffer.from('%PDF'), [1])).rejects.toThrow('Command failed');

        expect(fs.readdirSync(tempDir)).toEqual([]);
    });
});

describe('conversion of a file given by path', () => {
    let tempDir: string;

    beforeEach(() => {
        toolExitCode.value = 0;
        tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'conversion-test-')));
        vi.stubEnv('TMPDIR', tempDir);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it.each([
        { name: 'mutoolPdfToText', convert: (file: string) => mutoolPdfToText(file) },
        { name: 'markdownWithMarkitdown', convert: (file: string) => markdownWithMarkitdown(file) },
    ])('$name hands the path to the tool and leaves the file in place', async ({ convert }) => {
        const input = path.join(tempDir, 'input.docx');
        fs.writeFileSync(input, 'input');

        await expect(convert(input)).resolves.toBe('converted text');

        const [, args] = vi.mocked(execActivityFile).mock.calls.at(-1) ?? [];
        expect(args).toContain(input);
        expect(fs.readdirSync(tempDir)).toEqual(['input.docx']);
    });
});
