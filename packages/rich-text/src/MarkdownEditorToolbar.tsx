import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import type { MouseEvent, ReactNode } from 'react';

export interface MarkdownEditorToolbarLabels {
    blockStyle: string;
    paragraph: string;
    heading1: string;
    heading2: string;
    heading3: string;
    bold: string;
    italic: string;
    strike: string;
    inlineCode: string;
    bulletList: string;
    orderedList: string;
    listActions: string;
    indentListItem: string;
    outdentListItem: string;
    blockquote: string;
    codeBlock: string;
    horizontalRule: string;
    table: string;
    tableActions: string;
    tableRows: string;
    tableColumns: string;
    addRowAbove: string;
    addRowBelow: string;
    deleteRow: string;
    addColumnLeft: string;
    addColumnRight: string;
    deleteColumn: string;
    deleteTable: string;
    undo: string;
    redo: string;
}

const DEFAULT_LABELS: MarkdownEditorToolbarLabels = {
    blockStyle: 'Block style',
    paragraph: 'Paragraph',
    heading1: 'Heading 1',
    heading2: 'Heading 2',
    heading3: 'Heading 3',
    bold: 'Bold',
    italic: 'Italic',
    strike: 'Strikethrough',
    inlineCode: 'Inline code',
    bulletList: 'Bullet list',
    orderedList: 'Numbered list',
    listActions: 'List actions',
    indentListItem: 'Increase indent',
    outdentListItem: 'Decrease indent',
    blockquote: 'Blockquote',
    codeBlock: 'Code block',
    horizontalRule: 'Horizontal rule',
    table: 'Insert table',
    tableActions: 'Table actions',
    tableRows: 'Rows',
    tableColumns: 'Columns',
    addRowAbove: 'Add row above',
    addRowBelow: 'Add row below',
    deleteRow: 'Delete row',
    addColumnLeft: 'Add column left',
    addColumnRight: 'Add column right',
    deleteColumn: 'Delete column',
    deleteTable: 'Delete table',
    undo: 'Undo',
    redo: 'Redo',
};

type TableAction =
    | 'add-row-above'
    | 'add-row-below'
    | 'delete-row'
    | 'add-column-left'
    | 'add-column-right'
    | 'delete-column'
    | 'delete-table';

type ListAction = 'indent-list-item' | 'outdent-list-item';

function runListAction(editor: Editor, action: ListAction): void {
    const chain = editor.chain().focus();
    if (action === 'indent-list-item') {
        chain.sinkListItem('listItem').run();
        return;
    }
    chain.liftListItem('listItem').run();
}

function runTableAction(editor: Editor, action: TableAction): void {
    const chain = editor.chain().focus();
    switch (action) {
        case 'add-row-above':
            chain.addRowBefore().run();
            return;
        case 'add-row-below':
            chain.addRowAfter().run();
            return;
        case 'delete-row':
            chain.deleteRow().run();
            return;
        case 'add-column-left':
            chain.addColumnBefore().run();
            return;
        case 'add-column-right':
            chain.addColumnAfter().run();
            return;
        case 'delete-column':
            chain.deleteColumn().run();
            return;
        case 'delete-table':
            chain.deleteTable().run();
    }
}

export interface MarkdownEditorToolbarProps {
    editor: Editor | null;
    mode?: 'component' | 'document';
    labels?: Partial<MarkdownEditorToolbarLabels>;
    className?: string;
}

interface ToolbarButtonProps {
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
}

function ToolbarButton({ label, active = false, disabled = false, onClick, children }: ToolbarButtonProps) {
    const retainSelection = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault();
    return (
        <button
            type="button"
            className="vertesia-rich-text-toolbar-button"
            aria-label={label}
            title={label}
            aria-pressed={active}
            data-active={active || undefined}
            disabled={disabled}
            onMouseDown={retainSelection}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

export function MarkdownEditorToolbar({
    editor,
    mode = 'document',
    labels: labelOverrides,
    className,
}: MarkdownEditorToolbarProps) {
    const labels = { ...DEFAULT_LABELS, ...labelOverrides };
    const state = useEditorState({
        editor,
        selector: ({ editor: currentEditor }) => {
            if (!currentEditor) {
                return {
                    heading: 'paragraph',
                    bold: false,
                    italic: false,
                    strike: false,
                    code: false,
                    bulletList: false,
                    orderedList: false,
                    canIndentListItem: false,
                    canOutdentListItem: false,
                    blockquote: false,
                    codeBlock: false,
                    table: false,
                    canUndo: false,
                    canRedo: false,
                };
            }
            return {
                heading: currentEditor.isActive('heading', { level: 1 })
                    ? '1'
                    : currentEditor.isActive('heading', { level: 2 })
                      ? '2'
                      : currentEditor.isActive('heading', { level: 3 })
                        ? '3'
                        : 'paragraph',
                bold: currentEditor.isActive('bold'),
                italic: currentEditor.isActive('italic'),
                strike: currentEditor.isActive('strike'),
                code: currentEditor.isActive('code'),
                bulletList: currentEditor.isActive('bulletList'),
                orderedList: currentEditor.isActive('orderedList'),
                canIndentListItem: currentEditor.can().sinkListItem('listItem'),
                canOutdentListItem: currentEditor.can().liftListItem('listItem'),
                blockquote: currentEditor.isActive('blockquote'),
                codeBlock: currentEditor.isActive('codeBlock'),
                table: currentEditor.isActive('table'),
                canUndo: currentEditor.can().chain().focus().undo().run(),
                canRedo: currentEditor.can().chain().focus().redo().run(),
            };
        },
    });

    if (!editor || !state) return null;

    return (
        <div className={className || 'vertesia-rich-text-toolbar'} role="toolbar" aria-label="Markdown formatting">
            {mode === 'document' ? (
                <select
                    className="vertesia-rich-text-toolbar-select"
                    aria-label={labels.blockStyle}
                    value={state.heading}
                    onChange={(event) => {
                        const value = event.target.value;
                        if (value === 'paragraph') {
                            editor.chain().focus().setParagraph().run();
                        } else {
                            editor
                                .chain()
                                .focus()
                                .setHeading({ level: Number(value) as 1 | 2 | 3 })
                                .run();
                        }
                    }}
                >
                    <option value="paragraph">{labels.paragraph}</option>
                    <option value="1">{labels.heading1}</option>
                    <option value="2">{labels.heading2}</option>
                    <option value="3">{labels.heading3}</option>
                </select>
            ) : null}
            <ToolbarButton
                label={labels.bold}
                active={state.bold}
                onClick={() => editor.chain().focus().toggleBold().run()}
            >
                <strong>B</strong>
            </ToolbarButton>
            <ToolbarButton
                label={labels.italic}
                active={state.italic}
                onClick={() => editor.chain().focus().toggleItalic().run()}
            >
                <em>I</em>
            </ToolbarButton>
            <ToolbarButton
                label={labels.strike}
                active={state.strike}
                onClick={() => editor.chain().focus().toggleStrike().run()}
            >
                <s>S</s>
            </ToolbarButton>
            <ToolbarButton
                label={labels.inlineCode}
                active={state.code}
                onClick={() => editor.chain().focus().toggleCode().run()}
            >
                {'<>'}
            </ToolbarButton>
            <ToolbarButton
                label={labels.bulletList}
                active={state.bulletList}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
                • List
            </ToolbarButton>
            <ToolbarButton
                label={labels.orderedList}
                active={state.orderedList}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
                1. List
            </ToolbarButton>
            {state.bulletList || state.orderedList ? (
                <select
                    className="vertesia-rich-text-toolbar-select vertesia-rich-text-list-actions"
                    aria-label={labels.listActions}
                    value=""
                    onChange={(event) => {
                        const action = event.target.value as ListAction | '';
                        if (action) runListAction(editor, action);
                    }}
                >
                    <option value="">{labels.listActions}</option>
                    <option value="indent-list-item" disabled={!state.canIndentListItem}>
                        {labels.indentListItem}
                    </option>
                    <option value="outdent-list-item" disabled={!state.canOutdentListItem}>
                        {labels.outdentListItem}
                    </option>
                </select>
            ) : null}
            <ToolbarButton
                label={labels.blockquote}
                active={state.blockquote}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
                “ ”
            </ToolbarButton>
            {mode === 'document' ? (
                <>
                    <ToolbarButton
                        label={labels.codeBlock}
                        active={state.codeBlock}
                        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    >
                        {'{ }'}
                    </ToolbarButton>
                    <ToolbarButton
                        label={labels.horizontalRule}
                        onClick={() => editor.chain().focus().setHorizontalRule().run()}
                    >
                        ―
                    </ToolbarButton>
                    <ToolbarButton
                        label={labels.table}
                        disabled={state.table}
                        onClick={() =>
                            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
                        }
                    >
                        Table
                    </ToolbarButton>
                </>
            ) : null}
            {state.table ? (
                <select
                    className="vertesia-rich-text-toolbar-select vertesia-rich-text-table-actions"
                    aria-label={labels.tableActions}
                    value=""
                    onChange={(event) => {
                        const action = event.target.value as TableAction | '';
                        if (action) runTableAction(editor, action);
                    }}
                >
                    <option value="">{labels.tableActions}</option>
                    <optgroup label={labels.tableRows}>
                        <option value="add-row-above">{labels.addRowAbove}</option>
                        <option value="add-row-below">{labels.addRowBelow}</option>
                        <option value="delete-row">{labels.deleteRow}</option>
                    </optgroup>
                    <optgroup label={labels.tableColumns}>
                        <option value="add-column-left">{labels.addColumnLeft}</option>
                        <option value="add-column-right">{labels.addColumnRight}</option>
                        <option value="delete-column">{labels.deleteColumn}</option>
                    </optgroup>
                    <optgroup label={labels.tableActions}>
                        <option value="delete-table">{labels.deleteTable}</option>
                    </optgroup>
                </select>
            ) : null}
            <span className="vertesia-rich-text-toolbar-spacer" />
            <ToolbarButton
                label={labels.undo}
                disabled={!state.canUndo}
                onClick={() => editor.chain().focus().undo().run()}
            >
                ↶
            </ToolbarButton>
            <ToolbarButton
                label={labels.redo}
                disabled={!state.canRedo}
                onClick={() => editor.chain().focus().redo().run()}
            >
                ↷
            </ToolbarButton>
        </div>
    );
}
