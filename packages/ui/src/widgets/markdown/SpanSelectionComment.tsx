import type { Editor } from '@vertesia/rich-text';
import { Button, cn, Textarea, useToast, VTooltip } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { MessageSquarePlus, Send, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
    MarkdownBlockAnchor,
    MarkdownBlockType,
    MarkdownEditingAction,
    MarkdownEditingResource,
} from './CollaborativeMarkdownRenderer.js';

/** Amount of surrounding rendered text captured on each side of a selection for re-anchoring. */
const CONTEXT_LENGTH = 80;

function createOperationId(): string {
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
        block_id: `span:${createOperationId()}`,
        block_type: resolveBlockType(editor, from),
        exact_text: exactText,
        ...(prefix.trim() ? { prefix } : {}),
        ...(suffix.trim() ? { suffix } : {}),
    };
}

interface SpanSelectionCommentProps {
    editor: Editor | null;
    resource: MarkdownEditingResource;
    baseVersion?: string;
    readOnly?: boolean;
    onAction: (action: MarkdownEditingAction) => void | Promise<void>;
}

/**
 * Toolbar for commenting on an arbitrary text selection inside the rich-text editor.
 * Replaces per-block "Comment on selection" affordances: the user highlights any span
 * of text, adds a note, and it is sent to the agent as a content-anchored comment
 * action — reusing the existing editing-action pipeline.
 */
export function SpanSelectionComment({ editor, resource, baseVersion, readOnly, onAction }: SpanSelectionCommentProps) {
    const { t } = useUITranslation();
    const toast = useToast();
    const [hasSelection, setHasSelection] = useState(false);
    const [composing, setComposing] = useState(false);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Selection frozen when the composer opens, so later cursor moves don't shift the anchor.
    const [pendingAnchor, setPendingAnchor] = useState<MarkdownBlockAnchor | null>(null);
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
        setComment('');
        setComposing(true);
    }, [editor, t, toast]);

    const cancel = useCallback(() => {
        setComposing(false);
        setPendingAnchor(null);
        setComment('');
    }, []);

    const submit = useCallback(async () => {
        const body = comment.trim();
        if (!pendingAnchor || !body || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await onAction({
                operation_id: createOperationId(),
                resource,
                base_version: baseVersion,
                action: 'comment',
                anchor: pendingAnchor,
                comment: body,
            });
            cancel();
        } finally {
            setIsSubmitting(false);
        }
    }, [baseVersion, cancel, comment, isSubmitting, onAction, pendingAnchor, resource]);

    if (readOnly) return null;

    return (
        <div className="shrink-0 border-b border-mixer-muted/20 px-3 py-1.5">
            {composing && pendingAnchor ? (
                <div className="space-y-2 rounded-md border border-mixer-info/30 bg-background p-2 shadow-sm">
                    <div className="line-clamp-2 text-xs text-muted">
                        <span className="font-medium text-foreground">{t('agent.commentingOn')}</span>{' '}
                        <span className="italic">“{pendingAnchor.exact_text}”</span>
                    </div>
                    <Textarea
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        placeholder={t('agent.commentOnSelectionPlaceholder')}
                        rows={3}
                        autoFocus
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                                event.preventDefault();
                                void submit();
                            }
                        }}
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={cancel} disabled={isSubmitting}>
                            <X className="me-1 size-4" />
                            {t('store.cancelEdit')}
                        </Button>
                        <Button size="sm" onClick={() => void submit()} disabled={!comment.trim() || isSubmitting}>
                            <Send className="me-1 size-4" />
                            {t('agent.send')}
                        </Button>
                    </div>
                </div>
            ) : (
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
            )}
        </div>
    );
}
