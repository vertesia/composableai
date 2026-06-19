import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { richTextExtensions } from '../../../../widgets/richTextEditor/index.js';
import { captureAnchor, reanchor } from './anchoring.js';

function makeEditor(markdown: string): Editor {
    return new Editor({ extensions: richTextExtensions, content: markdown, contentType: 'markdown' });
}

function textAt(editor: Editor, range: { from: number; to: number }): string {
    return editor.state.doc.textBetween(range.from, range.to);
}

function expectRange(range: { from: number; to: number } | null): { from: number; to: number } {
    expect(range).not.toBeNull();
    if (!range) throw new Error('expected a non-null range');
    return range;
}

let editor: Editor;
afterEach(() => editor?.destroy());

describe('comment anchoring', () => {
    it('captures the selected quote with surrounding context', () => {
        editor = makeEditor('The quick brown fox jumps over the lazy dog.');
        // Single paragraph: PM position = 1 + character offset. "brown" starts at offset 10.
        const anchor = captureAnchor(editor.state.doc, 11, 16);
        expect(anchor.quote).toBe('brown');
        expect(anchor.prefix.endsWith('The quick ')).toBe(true);
        expect(anchor.suffix.startsWith(' fox')).toBe(true);
    });

    it('re-anchors to the same text in the unchanged document', () => {
        editor = makeEditor('The quick brown fox jumps over the lazy dog.');
        const anchor = captureAnchor(editor.state.doc, 11, 16);
        const located = expectRange(reanchor(editor.state.doc, anchor));
        expect(textAt(editor, located)).toBe('brown');
    });

    it('re-anchors after text is inserted before the quote', () => {
        editor = makeEditor('The quick brown fox jumps over the lazy dog.');
        const anchor = captureAnchor(editor.state.doc, 11, 16);
        // Insert at the very start of the paragraph — shifts every later position.
        editor.commands.insertContentAt(1, 'XYZ ');
        const located = expectRange(reanchor(editor.state.doc, anchor));
        expect(textAt(editor, located)).toBe('brown');
    });

    it('disambiguates a repeated quote by surrounding context', () => {
        editor = makeEditor('one fox here and another fox there.');
        // The second "fox" — offset of "fox" in "...another fox there" is 25.
        const anchor = captureAnchor(editor.state.doc, 26, 29);
        expect(anchor.quote).toBe('fox');
        const located = expectRange(reanchor(editor.state.doc, anchor));
        // Should resolve to the second occurrence (context "another " before it).
        expect(editor.state.doc.textBetween(Math.max(1, located.from - 8), located.from)).toBe('another ');
    });

    it('returns null when the quoted text no longer exists', () => {
        editor = makeEditor('The quick brown fox.');
        const anchor = captureAnchor(editor.state.doc, 11, 16);
        editor.commands.setContent('A completely different sentence.', { contentType: 'markdown' });
        expect(reanchor(editor.state.doc, anchor)).toBeNull();
    });
});
