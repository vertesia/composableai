import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MockActivityEnvironment } from '@temporalio/testing';
import { beforeAll, describe, expect, it } from 'vitest';
import { markdownWithPandoc } from '../conversion/pandoc.js';

let activityContext: MockActivityEnvironment;

beforeAll(async () => {
    activityContext = new MockActivityEnvironment({ startToCloseTimeoutMs: 60_000 });
});

const fixture = (name: string) => path.join(__dirname, '../../fixtures', name);

/** What pandoc printed when it read the document on stdin, as this converter used to run it. */
function pandocFromStdin(file: string, fromFormat: string): string {
    const result = spawnSync('pandoc', ['-t', 'markdown', '-f', fromFormat], { input: fs.readFileSync(file) });
    expect(result.status).toBe(0);
    return result.stdout.toString();
}

describe('markdownWithPandoc', () => {
    it('should convert docx to markdown', async () => {
        const docx = fs.readFileSync(fixture('us-ciia.docx'));
        const result: string = await activityContext.run(markdownWithPandoc, Buffer.from(docx), 'docx');
        expect(result).to.include('confidential');
    });

    it.each([
        { file: 'us-ciia.docx', fromFormat: 'docx' },
        { file: 'us-ciia.docx', fromFormat: 'docx', asPath: true },
    ])('produces what pandoc printed from stdin, for $file (path: $asPath)', async ({ file, fromFormat, asPath }) => {
        const input = asPath ? fixture(file) : fs.readFileSync(fixture(file));

        const result = await activityContext.run(markdownWithPandoc, input, fromFormat);

        expect(result).toBe(pandocFromStdin(fixture(file), fromFormat));
    });

    it('converts html given by path, as it did from stdin', async () => {
        const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'pandoc-test-'));
        try {
            const html = path.join(dir, 'page.html');
            fs.writeFileSync(html, '<h1>Title</h1><p>Some <b>bold</b> text, é and 😀.</p><ul><li>one</li></ul>');

            const result = await activityContext.run(markdownWithPandoc, html, 'html');

            expect(result).toBe(pandocFromStdin(html, 'html'));
            expect(fs.existsSync(html)).toBe(true);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
