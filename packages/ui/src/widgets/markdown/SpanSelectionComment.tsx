import type { Editor } from '@vertesia/rich-text';
import { Button, cn, Textarea, useToast, VTooltip } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { MessageSquarePlus, Send, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MarkdownBlockAnchor, MarkdownBlockType } from './CollaborativeMarkdownRenderer.js';

/** Amount of surrounding rendered text captured on each side of a selection for re-anchoring. */
const CONTEXT_LENGTH = 80;

function createId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `span-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Map the ProseMirror node enclosing the selection to a MarkdownBlockType label. */
function resolveBlockType(editor: Editor, pos: number): MarkdownBlockType {
    const $pos = editor.state.doc.resolve(Math.min(pos, editor.state.doc.content.size));
    for (let depth = $pos.depth; depth >= 0; depth--) {
        switch ($pos.node(depth).type.name) {
            case 'heading':
                return 'heading';
            case 'codeBlock':
            case 'vertesiaCodeBlock':
                return 'code_block';
            case 'blockquote':
                return 'blockquote';
            case 'listItem':
            case 'taskItem':
                return 'list_item';
            case 'bulletList':
            case 'orderedList':
            case 'taskList':
                return 'list';
            case 'table':
                return 'table';
        }
    }
    return 'paragraph';
}

/**
 * Build a content-anchored selector for an arbitrary text span (not a whole block).
 * `exact_text` is the selected rendered text; `prefix`/`suffix` capture surrounding
 * context so the agent can relocate the span even after the document shifts. This is
 * the same TextQuoteSelector model the block anchors use, minus the source range.
 */
export function captureSpanAnchor(editor: Editor, from: number, to: number): MarkdownBlockAnchor | null {
    if (from >= to) return null;
    const doc = editor.state.doc;
    const exactText = doc.textBetween(from, to, '\n', ' ').trim();
    if (!exactText) return null;
    const prefix = doc.textBetween(Math.max(0, from - CONTEXT_LENGTH), from, '\n', ' ');
    const suffix = doc.textBetween(to, Math.min(doc.content.size, to + CONTEXT_LENGTH), '\n', ' ');
    return {
        block_id: `span:${createId()}`,
        block_type: resolveBlockType(editor, from),
        exact_text: exactText,
        ...(prefix.trim() ? { prefix } : {}),
        ...(suffix.trim() ? { suffix } : {}),
    };
}

interface PendingComment {
    id: string;
    blockType: MarkdownBlockType;
    quote: string;
    comment: string;
}

/** Compose the batch of comments into a single instruction sent to the agent. */
function composeCommentMessage(comments: PendingComment[]): string {
    const count = comments.length;
    const items = comments.map((entry, index) => {
        const location = entry.blockType.replaceAll('_', ' ');
        return `${index + 1}. On the ${location} “${entry.quote}”:\n   ${entry.comment}`;
    });
    return [
        `I've left ${count} comment${count === 1 ? '' : 's'} on the document:`,
        '',
        ...items,
        '',
        'Please revise the document to address each comment, preserving everything else.',
    ].join('\n');
}

interface SpanSelectionCommentProps {
    editor: Editor | null;
    readOnly?: boolean;
    /** Send the composed batch of comments to the agent as one conversation message. */
    onSend: (message: string) => void | Promise<void>;
}

/**
 * Comment on arbitrary text selections and queue them up. The user highlights any span,
 * adds a note (repeat for as many passages as they like), then sends the whole batch to the
 * agent as a single message — no per-comment round trips, no editing-action cards.
 */
export function SpanSelectionComment({ editor, readOnly, onSend }: SpanSelectionCommentProps) {
    const { t } = useUITranslation();
    const toast = useToast();
    const [hasSelection, setHasSelection] = useState(false);
    const [composing, setComposing] = useState(false);
    const [draft, setDraft] = useState('');
    const [pendingAnchor, setPendingAnchor] = useState<MarkdownBlockAnchor | null>(null);
    const [pending, setPending] = useState<PendingComment[]>([]);
    const [showList, setShowList] = useState(false);
    const [isSending, setIsSending] = useState(false);
    // Latest non-empty selection, captured before the toolbar button steals focus.
    const lastRangeRef = useRef<{ from: number; to: number } | null>(null);

    useEffect(() => {
        if (!editor) return;
        const update = () => {
            const { from, to } = editor.state.selection;
            const nonEmpty = to > from && Boolean(editor.state.doc.textBetween(from, to, ' ', ' ').trim());
            setHasSelection(nonEmpty);
            if (nonEmpty) lastRangeRef.current = { from, to };
        };
        update();
        editor.on('selectionUpdate', update);
        editor.on('transaction', update);
        return () => {
            editor.off('selectionUpdate', update);
            editor.off('transaction', update);
        };
    }, [editor]);

    const startComment = useCallback(() => {
        const range = lastRangeRef.current;
        const anchor = editor && range ? captureSpanAnchor(editor, range.from, range.to) : null;
        if (!anchor) {
            toast({ status: 'info', title: t('agent.selectTextToComment'), duration: 2500 });
            return;
        }
        setPendingAnchor(anchor);
        setDraft('');
        setComposing(true);
    }, [editor, t, toast]);

    const cancelDraft = useCallback(() => {
        setComposing(false);
        setPendingAnchor(null);
        setDraft('');
    }, []);

    const addComment = useCallback(() => {
        const body = draft.trim();
        if (!pendingAnchor || !body) return;
        setPending((current) => [
            ...current,
            { id: createId(), blockType: pendingAnchor.block_type, quote: pendingAnchor.exact_text, comment: body },
        ]);
        setComposing(false);
        setPendingAnchor(null);
        setDraft('');
        setShowList(true);
    }, [draft, pendingAnchor]);

    const removeComment = useCallback((id: string) => {
        setPending((current) => current.filter((entry) => entry.id !== id));
    }, []);

    const sendAll = useCallback(async () => {
        if (pending.length === 0 || isSending) return;
        setIsSending(true);
        try {
            await onSend(composeCommentMessage(pending));
            setPending([]);
            setShowList(false);
        } finally {
            setIsSending(false);
        }
    }, [isSending, onSend, pending]);

    if (readOnly) return null;

    return (
        <div className="shrink-0 border-b border-mixer-muted/20">
            <div className="flex items-center gap-1 px-3 py-1.5">
                <VTooltip description={hasSelection ? t('agent.commentOnSelection') : t('agent.selectTextToComment')}>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn('h-7', !hasSelection && 'opacity-60')}
                        onClick={startComment}
                    >
                        <MessageSquarePlus className="me-1 size-4" />
                        {t('agent.commentOnSelection')}
                    </Button>
                </VTooltip>
                {pending.length > 0 ? (
                    <>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-muted"
                            onClick={() => setShowList((value) => !value)}
                        >
                            {t('agent.comments')} ({pending.length})
                        </Button>
                        <Button size="sm" className="ms-auto h-7" onClick={() => void sendAll()} disabled={isSending}>
                            <Send className="me-1 size-4" />
                            {t('agent.sendToAgent')}
                        </Button>
                    </>
                ) : null}
            </div>

            {composing && pendingAnchor ? (
                <div className="space-y-2 border-t border-mixer-muted/15 px-3 py-2">
                    <div className="line-clamp-2 text-xs text-muted">
                        <span className="font-medium text-foreground">{t('agent.commentingOn')}</span>{' '}
                        <span className="italic">“{pendingAnchor.exact_text}”</span>
                    </div>
                    <Textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder={t('agent.commentOnSelectionPlaceholder')}
                        rows={3}
                        autoFocus
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                                event.preventDefault();
                                addComment();
                            }
                        }}
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={cancelDraft}>
                            {t('store.cancelEdit')}
                        </Button>
                        <Button size="sm" onClick={addComment} disabled={!draft.trim()}>
                            {t('agent.addComment')}
                        </Button>
                    </div>
                </div>
            ) : null}

            {showList && pending.length > 0 ? (
                <ul className="max-h-48 space-y-1.5 overflow-y-auto border-t border-mixer-muted/15 px-3 py-2">
                    {pending.map((entry) => (
                        <li
                            key={entry.id}
                            className="flex items-start gap-2 rounded-md border border-mixer-muted/20 bg-muted/10 px-2 py-1.5"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-[11px] italic text-muted">“{entry.quote}”</div>
                                <div className="whitespace-pre-wrap text-xs text-foreground">{entry.comment}</div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                aria-label={t('agent.deleteComment')}
                                title={t('agent.deleteComment')}
                                className="size-6 shrink-0 p-0 text-muted"
                                onClick={() => removeComment(entry.id)}
                            >
                                <X className="size-3.5" />
                            </Button>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}
