import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { expect, test } from 'vitest';
import { manyToMarkdown } from './pandoc.js';

// Add more test cases for other file types (ODT, DOCX) if needed
test('should convert docx to markdown', async () => {
    const docx: Buffer = fs.readFileSync(path.join(__dirname, '../fixtures', 'us-ciia.docx'));
    const result = await manyToMarkdown(Readable.from(docx), 'docx');
    expect(result).to.include('confidential');
});
