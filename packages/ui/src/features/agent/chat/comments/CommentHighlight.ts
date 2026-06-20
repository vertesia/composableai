import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface CommentDecorationRange {
    from: number;
    to: number;
    commentId: string;
    /** Comment status — resolved comments are highlighted more subtly. */
    resolved: boolean;
}

export interface CommentHighlightOptions {
    /** Called when the user clicks a highlighted (commented) span in the editor. */
    onCommentClick?: (commentId: string) => void;
}

export const commentHighlightPluginKey = new PluginKey<DecorationSet>('commentHighlight');

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        commentHighlight: {
            /** Replace the set of comment highlights with the given ranges. */
            setCommentDecorations: (ranges: CommentDecorationRange[]) => ReturnType;
        };
    }
}

/**
 * Tiptap extension that renders comment highlights as ProseMirror inline decorations.
 *
 * Decorations are view-only (they never touch the document or its markdown serialization).
 * They map across local edits automatically, and the consumer re-applies a freshly re-anchored
 * set whenever comments change or the document is reloaded (e.g. after the agent edits it).
 */
export const CommentHighlight = Extension.create<CommentHighlightOptions>({
    name: 'commentHighlight',

    addOptions() {
        return { onCommentClick: undefined };
    },

    addCommands() {
        return {
            setCommentDecorations:
                (ranges: CommentDecorationRange[]) =>
                ({ tr, dispatch }) => {
                    if (dispatch) {
                        tr.setMeta(commentHighlightPluginKey, ranges);
                    }
                    return true;
                },
        };
    },

    addProseMirrorPlugins() {
        const options = this.options;
        return [
            new Plugin<DecorationSet>({
                key: commentHighlightPluginKey,
                state: {
                    init: () => DecorationSet.empty,
                    apply(tr, old) {
                        const ranges = tr.getMeta(commentHighlightPluginKey) as CommentDecorationRange[] | undefined;
                        if (ranges) {
                            const decorations = ranges
                                .filter((range) => range.from < range.to)
                                .map((range) =>
                                    Decoration.inline(
                                        range.from,
                                        range.to,
                                        {
                                            class: range.resolved
                                                ? 'cursor-pointer rounded-sm bg-muted/30'
                                                : 'cursor-pointer rounded-sm bg-attention/25',
                                            'data-comment-id': range.commentId,
                                        },
                                        { commentId: range.commentId },
                                    ),
                                );
                            return DecorationSet.create(tr.doc, decorations);
                        }
                        // No new ranges: map the existing highlights across the edit.
                        return old.map(tr.mapping, tr.doc);
                    },
                },
                props: {
                    decorations(state) {
                        return commentHighlightPluginKey.getState(state);
                    },
                    handleClick(view, pos) {
                        const onCommentClick = options.onCommentClick;
                        if (!onCommentClick) return false;
                        const set = commentHighlightPluginKey.getState(view.state);
                        const commentId = set?.find(pos, pos)[0]?.spec?.commentId as string | undefined;
                        if (commentId) {
                            onCommentClick(commentId);
                            return true;
                        }
                        return false;
                    },
                },
            }),
        ];
    },
});
