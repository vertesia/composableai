import type { Editor } from '@vertesia/rich-text';
import {
    Button,
    cn,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import {
    Bold,
    ChevronDown,
    Code,
    Italic,
    List,
    ListOrdered,
    Minus,
    Quote,
    Redo2,
    SquareCode,
    Strikethrough,
    Table,
    Undo2,
} from 'lucide-react';
import { type ComponentType, useEffect, useState } from 'react';

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
            className={cn('size-8 shrink-0 p-0 text-muted', active && 'bg-info/15 text-info hover:text-info')}
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
}

/**
 * Clean, icon-based formatting toolbar for the Markdown document editor. Reactive to the
 * current selection; uses the shared `richText.*` i18n strings for accessible names.
 */
export function EditorToolbar({ editor, className }: EditorToolbarProps) {
    const { t } = useUITranslation();
    useEditorRevision(editor);
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

    return (
        <div
            role="toolbar"
            aria-label={t('richText.blockStyle')}
            className={cn(
                'flex min-h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-mixer-muted/25 bg-muted/10 px-2 py-1',
                className,
            )}
        >
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        onMouseDown={retainSelection}
                        className="h-8 shrink-0 gap-1 px-2 text-xs font-medium text-muted"
                    >
                        {blockLabel}
                        <ChevronDown className="size-3" />
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
            <ToolButton
                icon={Table}
                label={t('richText.table')}
                disabled={editor.isActive('table')}
                onClick={() => chain(editor).focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            />

            <div className="ms-auto flex items-center gap-0.5">
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
            </div>
        </div>
    );
}
