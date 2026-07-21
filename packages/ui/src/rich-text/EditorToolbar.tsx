import type { Editor } from '@vertesia/rich-text';
import {
    Button,
    cn,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Textarea,
    useToast,
    VTooltip,
} from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import {
    Bold,
    ChevronDown,
    Code,
    Italic,
    List,
    ListOrdered,
    MessageSquarePlus,
    Minus,
    Quote,
    Redo2,
    Send,
    SquareCode,
    Strikethrough,
    Table,
    Undo2,
    X,
} from 'lucide-react';
import { type ComponentType, useCallback, useEffect, useRef, useState } from 'react';

/**
 * The formatting commands (toggleBold, setHeading, …) are augmented onto Tiptap's chain by the
 * editor extensions, which live in @vertesia/rich-text and are not in @vertesia/ui's type scope.
 * They exist at runtime; type only the ones this toolbar uses, narrowly, to avoid `any`.
 */
interface EditorChain {
    focus(): EditorChain;
    run(): boolean;
    setParagraph(): EditorChain;
    setHeading(attrs: { level: 1 | 2 | 3 }): EditorChain;
    toggleBold(): EditorChain;
    toggleItalic(): EditorChain;
    toggleStrike(): EditorChain;
    toggleCode(): EditorChain;
    toggleBulletList(): EditorChain;
    toggleOrderedList(): EditorChain;
    toggleBlockquote(): EditorChain;
    toggleCodeBlock(): EditorChain;
    setHorizontalRule(): EditorChain;
    insertTable(attrs: { rows: number; cols: number; withHeaderRow: boolean }): EditorChain;
    addRowBefore(): EditorChain;
    addRowAfter(): EditorChain;
    deleteRow(): EditorChain;
    addColumnBefore(): EditorChain;
    addColumnAfter(): EditorChain;
    deleteColumn(): EditorChain;
    deleteTable(): EditorChain;
    undo(): EditorChain;
    redo(): EditorChain;
}

const chain = (editor: Editor): EditorChain => editor.chain() as unknown as EditorChain;
const canChain = (editor: Editor): EditorChain => editor.can().chain() as unknown as EditorChain;

/** Force a re-render whenever the editor's selection or content changes, so active/enabled state stays live. */
function useEditorRevision(editor: Editor | null): void {
    const [, setRevision] = useState(0);
    useEffect(() => {
        if (!editor) return;
        const update = () => setRevision((value) => value + 1);
        editor.on('transaction', update);
        editor.on('selectionUpdate', update);
        return () => {
            editor.off('transaction', update);
            editor.off('selectionUpdate', update);
        };
    }, [editor]);
}

// Keep the toolbar from stealing the editor selection when a control is pressed.
const retainSelection = (event: React.MouseEvent) => event.preventDefault();

function createId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface Selection {
    blockLabel: string;
    quote: string;
}

/** Human-readable block label + selected text for the enclosing node of the current selection. */
function readSelection(editor: Editor): Selection | null {
    const { from, to } = editor.state.selection;
    if (from >= to) return null;
    const quote = editor.state.doc.textBetween(from, to, '\n', ' ').trim();
    if (!quote) return null;
    const $from = editor.state.doc.resolve(from);
    let blockLabel = 'paragraph';
    for (let depth = $from.depth; depth >= 0; depth--) {
        const name = $from.node(depth).type.name;
        if (name === 'heading') {
            blockLabel = 'heading';
            break;
        }
        if (name === 'codeBlock' || name === 'vertesiaCodeBlock') {
            blockLabel = 'code block';
            break;
        }
        if (name === 'blockquote') {
            blockLabel = 'quote';
            break;
        }
        if (name === 'listItem' || name === 'taskItem') {
            blockLabel = 'list item';
            break;
        }
        if (name === 'table') {
            blockLabel = 'table';
            break;
        }
    }
    return { blockLabel, quote };
}

interface PendingComment extends Selection {
    id: string;
    comment: string;
}

function composeCommentMessage(comments: PendingComment[]): string {
    const count = comments.length;
    const items = comments.map(
        (entry, index) => `${index + 1}. On the ${entry.blockLabel} “${entry.quote}”:\n   ${entry.comment}`,
    );
    return [
        `I've left ${count} comment${count === 1 ? '' : 's'} on the document:`,
        '',
        ...items,
        '',
        'Please revise the document to address each comment, preserving everything else.',
    ].join('\n');
}

function ToolButton({
    icon: Icon,
    label,
    active = false,
    disabled = false,
    onClick,
}: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
}) {
    return (
        <Button
            variant="ghost"
            size="sm"
            aria-label={label}
            title={label}
            aria-pressed={active}
            disabled={disabled}
            onMouseDown={retainSelection}
            onClick={onClick}
            className={cn(
                'size-8 shrink-0 rounded-md p-0 text-foreground hover:bg-muted/60',
                active && 'bg-muted text-foreground',
            )}
        >
            <Icon className="size-4" />
        </Button>
    );
}

function Divider() {
    return <div className="mx-0.5 h-5 w-px shrink-0 bg-mixer-muted/30" aria-hidden />;
}

export interface EditorToolbarProps {
    editor: Editor | null;
    className?: string;
    /**
     * When provided, the toolbar also shows comment controls: the user queues comments on text
     * selections and this sends the whole batch to the agent as one message.
     */
    onSendComment?: (message: string) => void | Promise<void>;
}

/**
 * Clean, icon-based formatting toolbar for the Markdown document editor, optionally with inline
 * comment controls. Reactive to the current selection; uses the shared `richText.*` i18n strings.
 */
export function EditorToolbar({ editor, className, onSendComment }: EditorToolbarProps) {
    const { t } = useUITranslation();
    const toast = useToast();
    useEditorRevision(editor);

    const [hasSelection, setHasSelection] = useState(false);
    const [composing, setComposing] = useState(false);
    const [draft, setDraft] = useState('');
    const [pendingSelection, setPendingSelection] = useState<Selection | null>(null);
    const [pending, setPending] = useState<PendingComment[]>([]);
    const [showList, setShowList] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const lastSelectionRef = useRef<Selection | null>(null);

    useEffect(() => {
        if (!editor || !onSendComment) return;
        const update = () => {
            const selection = readSelection(editor);
            setHasSelection(Boolean(selection));
            if (selection) lastSelectionRef.current = selection;
        };
        update();
        editor.on('selectionUpdate', update);
        editor.on('transaction', update);
        return () => {
            editor.off('selectionUpdate', update);
            editor.off('transaction', update);
        };
    }, [editor, onSendComment]);

    const startComment = useCallback(() => {
        const selection = lastSelectionRef.current;
        if (!selection) {
            toast({ status: 'info', title: t('agent.selectTextToComment'), duration: 2500 });
            return;
        }
        setPendingSelection(selection);
        setDraft('');
        setComposing(true);
    }, [t, toast]);

    const cancelDraft = useCallback(() => {
        setComposing(false);
        setPendingSelection(null);
        setDraft('');
    }, []);

    const addComment = useCallback(() => {
        const body = draft.trim();
        if (!pendingSelection || !body) return;
        setPending((current) => [...current, { id: createId(), ...pendingSelection, comment: body }]);
        setComposing(false);
        setPendingSelection(null);
        setDraft('');
        setShowList(true);
    }, [draft, pendingSelection]);

    const removeComment = useCallback((id: string) => {
        setPending((current) => current.filter((entry) => entry.id !== id));
    }, []);

    const sendAll = useCallback(async () => {
        if (!onSendComment || pending.length === 0 || isSending) return;
        setIsSending(true);
        try {
            await onSendComment(composeCommentMessage(pending));
            setPending([]);
            setShowList(false);
        } finally {
            setIsSending(false);
        }
    }, [isSending, onSendComment, pending]);

    if (!editor) return null;

    const headingLevel = ([1, 2, 3] as const).find((level) => editor.isActive('heading', { level }));
    const blockLabel =
        headingLevel === 1
            ? t('richText.heading1')
            : headingLevel === 2
              ? t('richText.heading2')
              : headingLevel === 3
                ? t('richText.heading3')
                : t('richText.paragraph');
    const inTable = editor.isActive('table');

    return (
        <>
            <div
                role="toolbar"
                aria-label={t('richText.blockStyle')}
                className={cn(
                    'flex min-h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-mixer-muted/25 px-1.5 py-1',
                    className,
                )}
            >
                <ToolButton
                    icon={Undo2}
                    label={t('richText.undo')}
                    disabled={!canChain(editor).focus().undo().run()}
                    onClick={() => chain(editor).focus().undo().run()}
                />
                <ToolButton
                    icon={Redo2}
                    label={t('richText.redo')}
                    disabled={!canChain(editor).focus().redo().run()}
                    onClick={() => chain(editor).focus().redo().run()}
                />

                <Divider />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            onMouseDown={retainSelection}
                            className="h-8 shrink-0 gap-1 px-2 text-xs font-medium text-foreground hover:bg-muted/60"
                        >
                            {blockLabel}
                            <ChevronDown className="size-3 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => chain(editor).focus().setParagraph().run()}>
                            {t('richText.paragraph')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => chain(editor).focus().setHeading({ level: 1 }).run()}>
                            {t('richText.heading1')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => chain(editor).focus().setHeading({ level: 2 }).run()}>
                            {t('richText.heading2')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => chain(editor).focus().setHeading({ level: 3 }).run()}>
                            {t('richText.heading3')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <Divider />

                <ToolButton
                    icon={Bold}
                    label={t('richText.bold')}
                    active={editor.isActive('bold')}
                    onClick={() => chain(editor).focus().toggleBold().run()}
                />
                <ToolButton
                    icon={Italic}
                    label={t('richText.italic')}
                    active={editor.isActive('italic')}
                    onClick={() => chain(editor).focus().toggleItalic().run()}
                />
                <ToolButton
                    icon={Strikethrough}
                    label={t('richText.strike')}
                    active={editor.isActive('strike')}
                    onClick={() => chain(editor).focus().toggleStrike().run()}
                />
                <ToolButton
                    icon={Code}
                    label={t('richText.inlineCode')}
                    active={editor.isActive('code')}
                    onClick={() => chain(editor).focus().toggleCode().run()}
                />

                <Divider />

                <ToolButton
                    icon={List}
                    label={t('richText.bulletList')}
                    active={editor.isActive('bulletList')}
                    onClick={() => chain(editor).focus().toggleBulletList().run()}
                />
                <ToolButton
                    icon={ListOrdered}
                    label={t('richText.orderedList')}
                    active={editor.isActive('orderedList')}
                    onClick={() => chain(editor).focus().toggleOrderedList().run()}
                />
                <ToolButton
                    icon={Quote}
                    label={t('richText.blockquote')}
                    active={editor.isActive('blockquote')}
                    onClick={() => chain(editor).focus().toggleBlockquote().run()}
                />
                <ToolButton
                    icon={SquareCode}
                    label={t('richText.codeBlock')}
                    active={editor.isActive('codeBlock')}
                    onClick={() => chain(editor).focus().toggleCodeBlock().run()}
                />

                <Divider />

                <ToolButton
                    icon={Minus}
                    label={t('richText.horizontalRule')}
                    onClick={() => chain(editor).focus().setHorizontalRule().run()}
                />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            aria-label={t('richText.tableActions')}
                            title={inTable ? t('richText.tableActions') : t('richText.table')}
                            onMouseDown={retainSelection}
                            className={cn(
                                'size-8 shrink-0 rounded-md p-0 text-foreground hover:bg-muted/60',
                                inTable && 'bg-muted',
                            )}
                        >
                            <Table className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        {inTable ? (
                            <>
                                <DropdownMenuItem onClick={() => chain(editor).focus().addRowBefore().run()}>
                                    {t('richText.addRowAbove')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => chain(editor).focus().addRowAfter().run()}>
                                    {t('richText.addRowBelow')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => chain(editor).focus().deleteRow().run()}>
                                    {t('richText.deleteRow')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => chain(editor).focus().addColumnBefore().run()}>
                                    {t('richText.addColumnLeft')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => chain(editor).focus().addColumnAfter().run()}>
                                    {t('richText.addColumnRight')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => chain(editor).focus().deleteColumn().run()}>
                                    {t('richText.deleteColumn')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => chain(editor).focus().deleteTable().run()}>
                                    {t('richText.deleteTable')}
                                </DropdownMenuItem>
                            </>
                        ) : (
                            <DropdownMenuItem
                                onClick={() =>
                                    chain(editor).focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
                                }
                            >
                                {t('richText.table')}
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                {onSendComment ? (
                    <div className="ms-auto flex shrink-0 items-center gap-1 ps-1">
                        <VTooltip
                            description={hasSelection ? t('agent.commentOnSelection') : t('agent.selectTextToComment')}
                        >
                            <Button
                                variant="ghost"
                                size="sm"
                                onMouseDown={retainSelection}
                                onClick={startComment}
                                aria-label={t('agent.commentOnSelection')}
                                className={cn(
                                    'size-8 shrink-0 rounded-md p-0 text-foreground hover:bg-muted/60',
                                    !hasSelection && 'opacity-60',
                                )}
                            >
                                <MessageSquarePlus className="size-4" />
                            </Button>
                        </VTooltip>
                        {pending.length > 0 ? (
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-xs text-muted"
                                    onClick={() => setShowList((value) => !value)}
                                >
                                    {t('agent.comments')} ({pending.length})
                                </Button>
                                <Button size="sm" className="h-8" onClick={() => void sendAll()} disabled={isSending}>
                                    <Send className="me-1 size-4" />
                                    {t('agent.sendToAgent')}
                                </Button>
                            </>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {composing && pendingSelection ? (
                <div className="shrink-0 space-y-2 border-b border-mixer-muted/15 px-3 py-2">
                    <div className="line-clamp-2 text-xs text-muted">
                        <span className="font-medium text-foreground">{t('agent.commentingOn')}</span>{' '}
                        <span className="italic">“{pendingSelection.quote}”</span>
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
                <ul className="max-h-48 shrink-0 space-y-1.5 overflow-y-auto border-b border-mixer-muted/15 px-3 py-2">
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
        </>
    );
}
