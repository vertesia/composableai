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

test('should compact HTML while preserving referenced anchors, visible XBRL facts, links, and tables', async () => {
    const html = `
        <script>ignored script</script>
        <style>.presentation { color: red }</style>
        <div style="color: red; DISPLAY : none !IMPORTANT"><ix:header>hidden taxonomy</ix:header></div>
        <div hidden><p>hidden paragraph</p></div>
        <h2 style="display:none">Hidden heading</h2>
        <table hidden><tr><td>Hidden table</td></tr></table>
        <p><a href="https://example.com/hidden" style="display:none">Hidden link</a></p>
        <p><img src="hidden.png" alt="Hidden image" style="display:none"></p>
        <div style="--display:none; display-mode:none">Visible custom display property</div>
        <div id="results" class="presentation" style="font-size: 10pt">
            <h1>Results</h1>
            <p>Revenue was <ix:nonfraction name="us-gaap:Revenue">42.5</ix:nonfraction> billion.</p>
            <p><a href="#results">Results section</a></p>
            <p><a href="https://example.com/report">Full report</a></p>
            <table><tr><th>Year</th><th>Revenue</th></tr><tr><td>2026</td><td>42.5</td></tr></table>
        </div>
    `;

    const result = await activityContext.run(markdownWithPandoc, Buffer.from(html), 'html');

    expect(result).not.toContain('hidden taxonomy');
    expect(result).not.toContain('hidden paragraph');
    expect(result).not.toContain('Hidden heading');
    expect(result).not.toContain('Hidden table');
    expect(result).not.toContain('Hidden link');
    expect(result).not.toContain('Hidden image');
    expect(result).not.toContain('font-size');
    expect(result).not.toContain('presentation');
    expect(result).toContain('Visible custom display property');
    expect(result).toContain('Revenue was 42.5 billion.');
    expect(result).toContain('[Results section](#results)');
    expect(result).toContain('[Full report](https://example.com/report)');
    expect(result).toMatch(/Year\s+Revenue/);
    expect(result).toMatch(/2026\s+42\.5/);
    expect(result).toContain('{#results}');
});
