import { describe, expect, it } from 'vitest';
import { createDirectEditsAppliedPrompt } from './documentEditingPrompts.js';

describe('createDirectEditsAppliedPrompt', () => {
    it('sends a compact unified diff with file headers', () => {
        const prompt = createDirectEditsAppliedPrompt(
            'drafts/document.md',
            ['@@ -2,3 +2,3 @@', ' unchanged', '-First paragraph.', '+Updated paragraph.'].join('\n'),
        );

        expect(prompt).toContain('--- a/drafts/document.md');
        expect(prompt).toContain('+++ b/drafts/document.md');
        expect(prompt).toContain('@@ -2,3 +2,3 @@');
        expect(prompt).toContain('-First paragraph.');
        expect(prompt).toContain('+Updated paragraph.');
        expect(prompt).toContain('do not re-apply it');
    });

    it('does not discard a unified diff larger than the previous fallback limit', () => {
        const unifiedDiff = Array.from({ length: 600 }, (_, index) => `-${'before'.repeat(2)} ${index}`).join('\n');
        const prompt = createDirectEditsAppliedPrompt('drafts/large.md', unifiedDiff);

        expect(prompt.length).toBeGreaterThan(4000);
        expect(prompt).toContain('-beforebefore 599');
    });
});
