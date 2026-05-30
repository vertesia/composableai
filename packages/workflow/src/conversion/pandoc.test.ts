import fs from 'node:fs';
import path from 'node:path';
import { MockActivityEnvironment } from '@temporalio/testing';
import { beforeAll, expect, test } from 'vitest';
import { markdownWithPandoc } from '../conversion/pandoc.js';

let activityContext: MockActivityEnvironment;

beforeAll(async () => {
    activityContext = new MockActivityEnvironment();
});

// Add more test cases for other file types (ODT, DOCX) if needed
test('should convert docx to markdown', async () => {
    const filepath = path.join(__dirname, '../../fixtures', 'us-ciia.docx');
    console.log('Converting file from', filepath);
    const docx = fs.readFileSync(filepath);
    const result: string = await activityContext.run(markdownWithPandoc, Buffer.from(docx), 'docx');
    expect(result).to.include('confidential');
});
