import { MockActivityEnvironment, TestWorkflowEnvironment } from '@temporalio/testing';
import fs from 'fs';
import path from 'path';
import { beforeAll, expect, test } from 'vitest';
import { manyToMarkdown } from '../conversion/pandoc';


let testEnv: TestWorkflowEnvironment;
let activityContext: MockActivityEnvironment;

beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
    activityContext = new MockActivityEnvironment();
});


// Add more test cases for other file types (ODT, DOCX) if needed
test('should convert docx to markdown', async () => {
    const filepath = path.join(__dirname, '../../fixtures', 'us-ciia.docx');
    console.log("Converting file from", filepath);
    const docx = fs.readFileSync(filepath);
    const result = await activityContext.run(manyToMarkdown, Buffer.from(docx), 'docx');
    expect(result).to.include('confidential');
});
