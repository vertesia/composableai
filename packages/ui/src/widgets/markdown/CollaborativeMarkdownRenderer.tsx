import { Button, cn, Textarea, VTooltip } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import type { Element } from 'hast';
import { MessageSquare, Pencil, Send, X } from 'lucide-react';
import React, { createContext, useContext, useMemo, useState } from 'react';
import type { Components } from 'react-markdown';
import { MarkdownRenderer, type MarkdownRendererProps } from './MarkdownRenderer';

export type MarkdownEditingResource =
    | {
          kind: 'store_document';
          document_id: string;
          name?: string;
      }
    | {
          kind: 'agent_artifact';
          run_id: string;
          path: string;
      };

export type MarkdownBlockType = 'heading' | 'paragraph' | 'list_item' | 'blockquote' | 'code_block' | 'table';

export interface MarkdownBlockAnchor {
    block_id: string;
    block_type: MarkdownBlockType;
    heading_path?: string[];
    source_range?: {
        start: number;
        end: number;
    };
    exact_text: string;
    prefix?: string;
    suffix?: string;
    /** Zero-based occurrence among identical blocks under the same heading path. */
    occurrence_index?: number;
}

export interface MarkdownEditingAction {
    operation_id: string;
    resource: MarkdownEditingResource;
    base_version?: string;
    action: 'comment' | 'edit';
    anchor: MarkdownBlockAnchor;
    comment?: string;
    user_change?: {
        before: string;
        after: string;
    };
}

export interface CollaborativeMarkdownRendererProps extends Omit<MarkdownRendererProps, 'children' | 'components'> {
    children: string;
    resource: MarkdownEditingResource;
    baseVersion?: string;
    components?: Components;
    readOnly?: boolean;
    onAction: (action: MarkdownEditingAction) => void | Promise<void>;
}

interface MarkdownBlockProps extends React.HTMLAttributes<HTMLElement> {
    node?: Element;
    children?: React.ReactNode;
}

type EditingMode = 'comment' | 'edit';

interface CollaborativeMarkdownContextValue {
    markdown: string;
    resource: MarkdownEditingResource;
    baseVersion?: string;
    readOnly: boolean;
    selectedBlockId: string | null;
    editingMode: EditingMode | null;
    draft: string;
    isSubmitting: boolean;
    beginEditing: (anchor: MarkdownBlockAnchor, mode: EditingMode) => void;
    cancelEditing: () => void;
    setDraft: (draft: string) => void;
    submit: (anchor: MarkdownBlockAnchor) => Promise<void>;
}

const CollaborativeMarkdownContext = createContext<CollaborativeMarkdownContextValue | null>(null);

const CONTEXT_LENGTH = 80;
const ATX_HEADING = /^ {0,3}(#{1,6})[\t ]+(.+?)[\t ]*#*[\t ]*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

function createOperationId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `edit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createMarkdownBlockAnchor(
    markdown: string,
    node: Element | undefined,
    blockType: MarkdownBlockType,
): MarkdownBlockAnchor {
    const start = node?.position?.start.offset;
    const end = node?.position?.end.offset;
    const hasRange = typeof start === 'number' && typeof end === 'number' && start >= 0 && end >= start;
    const exactText = hasRange ? markdown.slice(start, end) : '';
    const headingPath = hasRange ? getHeadingPath(markdown, start) : [];
    const occurrenceIndex = hasRange ? getOccurrenceIndex(markdown, exactText, start, headingPath) : undefined;

    return {
        block_id: hasRange ? `${blockType}:${start}:${end}` : `${blockType}:${createOperationId()}`,
        block_type: blockType,
        ...(headingPath.length > 0 ? { heading_path: headingPath } : {}),
        ...(hasRange ? { source_range: { start, end } } : {}),
        exact_text: exactText,
        ...(hasRange && start > 0 ? { prefix: markdown.slice(Math.max(0, start - CONTEXT_LENGTH), start) } : {}),
        ...(hasRange && end < markdown.length
            ? { suffix: markdown.slice(end, Math.min(markdown.length, end + CONTEXT_LENGTH)) }
            : {}),
        ...(typeof occurrenceIndex === 'number' ? { occurrence_index: occurrenceIndex } : {}),
    };
}

function getHeadingPath(markdown: string, offset: number): string[] {
    const headings: string[] = [];
    let inFence: '`' | '~' | null = null;
    let cursor = 0;

    for (const line of markdown.slice(0, offset).split('\n')) {
        const fenceMatch = FENCE.exec(line);
        if (fenceMatch) {
            const marker = fenceMatch[1]?.[0] as '`' | '~' | undefined;
            if (!inFence) inFence = marker ?? null;
            else if (marker === inFence) inFence = null;
            cursor += line.length + 1;
            continue;
        }

        if (!inFence) {
            const headingMatch = ATX_HEADING.exec(line);
            if (headingMatch) {
                const level = headingMatch[1]?.length ?? 1;
                const title = headingMatch[2]?.trim();
                if (title) {
                    headings.length = level - 1;
                    headings[level - 1] = title;
                }
            }
        }

        cursor += line.length + 1;
        if (cursor > offset) break;
    }

    return headings.filter((heading): heading is string => Boolean(heading));
}

function getOccurrenceIndex(markdown: string, exactText: string, offset: number, headingPath: string[]): number {
    if (!exactText) return 0;

    let occurrenceIndex = 0;
    let candidate = markdown.indexOf(exactText);
    while (candidate >= 0 && candidate < offset) {
        const candidateHeadingPath = getHeadingPath(markdown, candidate);
        if (
            candidateHeadingPath.length === headingPath.length &&
            candidateHeadingPath.every((heading, index) => heading === headingPath[index])
        ) {
            occurrenceIndex++;
        }
        candidate = markdown.indexOf(exactText, candidate + Math.max(1, exactText.length));
    }
    return occurrenceIndex;
}

function resourceReference(resource: MarkdownEditingResource): string {
    if (resource.kind === 'store_document') {
        return `store:${resource.document_id}`;
    }
    return `artifact:${resource.path} (run ${resource.run_id})`;
}

function markdownFence(...values: string[]): string {
    let longestRun = 0;
    for (const value of values) {
        for (const match of value.matchAll(/`+/g)) {
            longestRun = Math.max(longestRun, match[0].length);
        }
    }
    return '`'.repeat(Math.max(3, longestRun + 1));
}

export function formatMarkdownEditingAction(action: MarkdownEditingAction): string {
    const reference = resourceReference(action.resource);
    const location = action.anchor.block_type.replace('_', ' ');

    if (action.action === 'edit' && action.user_change) {
        const fence = markdownFence(action.user_change.before, action.user_change.after);
        return [
            `Apply my edit to the ${location} in ${reference}, then update the resource.`,
            `Operation: ${action.operation_id}`,
            'Preserve all content outside the selected block exactly; do not regenerate unrelated sections.',
            '',
            'Before:',
            `${fence}markdown`,
            action.user_change.before,
            fence,
            '',
            'After:',
            `${fence}markdown`,
            action.user_change.after,
            fence,
        ].join('\n');
    }

    const fence = markdownFence(action.anchor.exact_text);
    return [
        `Update the ${location} in ${reference} based on this comment:`,
        `Operation: ${action.operation_id}`,
        'Preserve all content outside the selected block exactly; do not regenerate unrelated sections.',
        '',
        action.comment ?? '',
        '',
        'Selected content:',
        `${fence}markdown`,
        action.anchor.exact_text,
        fence,
    ].join('\n');
}

function useCollaborativeMarkdownContext(): CollaborativeMarkdownContextValue {
    const context = useContext(CollaborativeMarkdownContext);
    if (!context) {
        throw new Error('Collaborative Markdown blocks must be rendered inside CollaborativeMarkdownRenderer');
    }
    return context;
}

function createBlockComponent(
    tag: keyof React.JSX.IntrinsicElements,
    blockType: MarkdownBlockType,
    ExistingComponent: React.ElementType | undefined,
) {
    return function CollaborativeBlock({ node, children: blockChildren, ...props }: MarkdownBlockProps) {
        const { t } = useUITranslation();
        const {
            markdown,
            readOnly,
            selectedBlockId,
            editingMode,
            draft,
            isSubmitting,
            beginEditing,
            cancelEditing,
            setDraft,
            submit,
        } = useCollaborativeMarkdownContext();
        const anchor = createMarkdownBlockAnchor(markdown, node, blockType);
        const isAnchorable = !readOnly && Boolean(anchor.source_range && anchor.exact_text);
        const isSelected = selectedBlockId === anchor.block_id;
        const containerClassName = cn(
            'group/collab relative rounded-md border transition-colors',
            tag === 'li' ? 'px-2' : '-mx-2 px-2',
            isSelected
                ? 'border-info bg-mixer-info/5'
                : isAnchorable
                  ? 'border-transparent hover:border-mixer-info/30 hover:bg-mixer-muted/10'
                  : 'border-transparent',
        );
        const controls = isAnchorable ? (
            <>
                <div
                    className={cn(
                        'absolute end-1 top-1 z-10 flex items-center gap-0.5 rounded-md border bg-background p-0.5 shadow-sm',
                        isSelected
                            ? 'opacity-100'
                            : 'pointer-events-none opacity-0 group-hover/collab:pointer-events-auto group-hover/collab:opacity-100 group-focus-within/collab:pointer-events-auto group-focus-within/collab:opacity-100',
                    )}
                >
                    <VTooltip description={t('agent.commentOnSelection')} asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            aria-label={t('agent.commentOnSelection')}
                            onClick={() => beginEditing(anchor, 'comment')}
                        >
                            <MessageSquare className="size-4" />
                        </Button>
                    </VTooltip>
                    <VTooltip description={t('agent.editSelection')} asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            aria-label={t('agent.editSelection')}
                            onClick={() => beginEditing(anchor, 'edit')}
                        >
                            <Pencil className="size-4" />
                        </Button>
                    </VTooltip>
                </div>
                {isSelected && editingMode && (
                    <div className="mb-2 space-y-2 rounded-md border border-mixer-info/30 bg-background p-2 shadow-sm">
                        <Textarea
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            placeholder={
                                editingMode === 'comment'
                                    ? t('agent.commentOnSelectionPlaceholder')
                                    : t('agent.editSelectionPlaceholder')
                            }
                            rows={editingMode === 'edit' ? 6 : 3}
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={cancelEditing} disabled={isSubmitting}>
                                <X className="me-1 size-4" />
                                {t('store.cancelEdit')}
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => void submit(anchor)}
                                disabled={!draft.trim() || isSubmitting}
                            >
                                <Send className="me-1 size-4" />
                                {t('agent.send')}
                            </Button>
                        </div>
                    </div>
                )}
            </>
        ) : null;

        if (tag === 'li') {
            const ListItem = ExistingComponent ?? 'li';
            return (
                <ListItem
                    {...(ExistingComponent ? { node } : {})}
                    {...props}
                    className={cn(props.className, containerClassName)}
                    data-collaborative-block={anchor.block_id}
                >
                    {blockChildren}
                    {controls}
                </ListItem>
            );
        }

        const rendered = ExistingComponent
            ? React.createElement(ExistingComponent, { node, ...props }, blockChildren)
            : React.createElement(tag, props, blockChildren);

        return (
            <div className={containerClassName} data-collaborative-block={anchor.block_id}>
                {rendered}
                {controls}
            </div>
        );
    };
}

export function CollaborativeMarkdownRenderer({
    children: markdown,
    resource,
    baseVersion,
    components,
    readOnly = false,
    onAction,
    className,
    ...markdownProps
}: CollaborativeMarkdownRendererProps) {
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [editingMode, setEditingMode] = useState<EditingMode | null>(null);
    const [draft, setDraft] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const collaborativeComponents = useMemo<Components>(() => {
        return {
            ...components,
            p: createBlockComponent('p', 'paragraph', components?.p as React.ElementType | undefined),
            h1: createBlockComponent('h1', 'heading', components?.h1 as React.ElementType | undefined),
            h2: createBlockComponent('h2', 'heading', components?.h2 as React.ElementType | undefined),
            h3: createBlockComponent('h3', 'heading', components?.h3 as React.ElementType | undefined),
            h4: createBlockComponent('h4', 'heading', components?.h4 as React.ElementType | undefined),
            h5: createBlockComponent('h5', 'heading', components?.h5 as React.ElementType | undefined),
            h6: createBlockComponent('h6', 'heading', components?.h6 as React.ElementType | undefined),
            li: createBlockComponent('li', 'list_item', components?.li as React.ElementType | undefined),
            blockquote: createBlockComponent(
                'blockquote',
                'blockquote',
                components?.blockquote as React.ElementType | undefined,
            ),
            pre: createBlockComponent('pre', 'code_block', components?.pre as React.ElementType | undefined),
            table: createBlockComponent('table', 'table', components?.table as React.ElementType | undefined),
        };
    }, [components]);

    const contextValue: CollaborativeMarkdownContextValue = {
        markdown,
        resource,
        baseVersion,
        readOnly,
        selectedBlockId,
        editingMode,
        draft,
        isSubmitting,
        beginEditing: (anchor, mode) => {
            setSelectedBlockId(anchor.block_id);
            setEditingMode(mode);
            setDraft(mode === 'edit' ? anchor.exact_text : '');
        },
        cancelEditing: () => {
            setEditingMode(null);
            setDraft('');
        },
        setDraft,
        submit: async (anchor) => {
            const trimmedDraft = draft.trim();
            if (!editingMode || !trimmedDraft || isSubmitting) return;
            const action: MarkdownEditingAction = {
                operation_id: createOperationId(),
                resource,
                base_version: baseVersion,
                action: editingMode,
                anchor,
                ...(editingMode === 'comment'
                    ? { comment: trimmedDraft }
                    : { user_change: { before: anchor.exact_text, after: draft } }),
            };

            setIsSubmitting(true);
            try {
                await onAction(action);
                setEditingMode(null);
                setDraft('');
            } finally {
                setIsSubmitting(false);
            }
        },
    };

    return (
        <CollaborativeMarkdownContext.Provider value={contextValue}>
            <MarkdownRenderer
                {...markdownProps}
                className={className}
                components={collaborativeComponents}
                preserveSourcePositions
            >
                {markdown}
            </MarkdownRenderer>
        </CollaborativeMarkdownContext.Provider>
    );
}
