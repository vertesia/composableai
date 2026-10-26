import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test, vi } from 'vitest';
import { pdfToText } from './mutool.js';

test('[mutool] should convert pdf to text', async () => {
    const pdf = fs.readFileSync(path.join(__dirname, '../fixtures', 'test-pdf2.pdf'));
    const buf = Buffer.from(pdf);
    console.log('Running mutoolPdfToText');
    const result: string = await pdfToText(buf);
    expect(result).toContain('its attentive Ambassadors');
});

test('[mutool] should leave no temporary file or descriptor behind', async () => {
    const pdf = fs.readFileSync(path.join(__dirname, '../fixtures', 'test-pdf2.pdf'));
    const tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'converters-mutool-test-')));
    vi.stubEnv('TMPDIR', tempDir);
    try {
        // /dev/fd lists this process's open descriptors on both Linux and macOS.
        const before = fs.readdirSync('/dev/fd').length;
        await pdfToText(pdf);
        expect(fs.readdirSync('/dev/fd').length).toBe(before);
        expect(fs.readdirSync(tempDir)).toEqual([]);
    } finally {
        vi.unstubAllEnvs();
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
