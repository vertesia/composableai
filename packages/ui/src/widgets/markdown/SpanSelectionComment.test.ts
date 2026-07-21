import { createMarkdownEditor } from '@vertesia/rich-text';
import { afterEach, describe, expect, it } from 'vitest';
import { captureSpanAnchor } from './SpanSelectionComment.js';

// In a single top-level text block the ProseMirror position of a character is
// 1 + its index in the block text (position 0 is the block boundary).
function rangeOf(text: string, needle: string): { from: number; to: number } {
    const index = text.indexOf(needle);
    return { from: 1 + index, to: 1 + index + needle.length };
}

describe('captureSpanAnchor', () => {
    const editors: { destroy(): void }[] = [];
    const make = (markdown: string) => {
        const editor = createMarkdownEditor({ content: markdown });
        editors.push(editor);
        return editor;
    };
    afterEach(() => {
        for (const editor of editors.splice(0)) editor.destroy();
    });

    it('captures an arbitrary span with surrounding context (not the whole block)', () => {
        const paragraph = 'The quick brown fox jumps.';
        const editor = make(paragraph);
        const { from, to } = rangeOf(paragraph, 'quick brown');

        const anchor = captureSpanAnchor(editor, from, to);

        expect(anchor?.exact_text).toBe('quick brown');
        expect(anchor?.block_type).toBe('paragraph');
        expect(anchor?.prefix).toBe('The ');
        expect(anchor?.suffix).toContain('fox jumps.');
        // A span anchor carries no source range — it relocates via quote + prefix/suffix.
        expect(anchor?.source_range).toBeUndefined();
    });

    it('labels the enclosing block type from the selection', () => {
        const heading = 'Section Heading';
        const editor = make(`# ${heading}`);
        const { from, to } = rangeOf(heading, 'Heading');

        expect(captureSpanAnchor(editor, from, to)?.block_type).toBe('heading');
    });

    it('returns null for an empty or whitespace-only selection', () => {
        const editor = make('Some text here.');
        expect(captureSpanAnchor(editor, 3, 3)).toBeNull();
        expect(captureSpanAnchor(editor, 5, 4)).toBeNull();
    });
});
