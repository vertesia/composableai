import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { richTextExtensions } from '../../../../widgets/richTextEditor/index.js';
import { CommentHighlight, commentHighlightPluginKey } from './CommentHighlight.js';

let editor: Editor;

afterEach(() => editor?.destroy());

function makeEditor(markdown: string): Editor {
    return new Editor({
        extensions: [...richTextExtensions, CommentHighlight],
        content: markdown,
        contentType: 'markdown',
    });
}

function decorations(ed: Editor) {
    const set = commentHighlightPluginKey.getState(ed.state);
    return set?.find(0, ed.state.doc.content.size) ?? [];
}

describe('CommentHighlight', () => {
    it('applies a decoration over a range, carrying the comment id', () => {
        editor = makeEditor('The quick brown fox.');
        editor.commands.setCommentDecorations([{ from: 5, to: 10, commentId: 'c1', resolved: false }]);
        const decos = decorations(editor);
        expect(decos).toHaveLength(1);
        expect((decos[0]?.spec as { commentId?: string })?.commentId).toBe('c1');
    });

    it('ignores empty (collapsed) ranges', () => {
        editor = makeEditor('Hello world.');
        editor.commands.setCommentDecorations([{ from: 3, to: 3, commentId: 'c1', resolved: false }]);
        expect(decorations(editor)).toHaveLength(0);
    });

    it('replaces the decoration set on each call (clears when empty)', () => {
        editor = makeEditor('Hello world.');
        editor.commands.setCommentDecorations([{ from: 1, to: 6, commentId: 'c1', resolved: false }]);
        expect(decorations(editor)).toHaveLength(1);
        editor.commands.setCommentDecorations([]);
        expect(decorations(editor)).toHaveLength(0);
    });

    it('maps a decoration across a local edit', () => {
        editor = makeEditor('The quick brown fox.');
        editor.commands.setCommentDecorations([{ from: 5, to: 10, commentId: 'c1', resolved: false }]);
        // Insert text at the start — the highlight should shift with the text it covers.
        editor.commands.insertContentAt(1, 'XYZ ');
        const decos = decorations(editor);
        expect(decos).toHaveLength(1);
        expect(editor.state.doc.textBetween(decos[0].from, decos[0].to)).toBe('quick');
    });
});
