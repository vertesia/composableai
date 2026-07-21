import {
    Button,
    cn,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Textarea,
    VTooltip,
} from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import type { Element } from 'hast';
import {
    BarChart3,
    Code2,
    Heading2,
    Link,
    List,
    MessageSquare,
    Pencil,
    Pilcrow,
    Plus,
    Quote,
    Send,
    Table2,
    X,
} from 'lucide-react';
import React, {
    createContext,
    lazy,
    Suspense,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
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

export type MarkdownBlockType =
    | 'heading'
    | 'paragraph'
    | 'list'
    /** Legacy anchors from before lists became the selectable unit. */
    | 'list_item'
    | 'blockquote'
    | 'code_block'
    | 'table';

/** Container blocks whose inner blocks must not offer their own selection controls. */
const CONTAINER_BLOCK_TYPES = new Set<MarkdownBlockType>(['list', 'blockquote', 'table']);

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
    /** True when the client already committed this change to the resource. */
    applied?: boolean;
    /** Revision/document id produced by an applied change. */
    updated_document_id?: string;
}

export interface CollaborativeMarkdownRendererProps extends Omit<MarkdownRendererProps, 'children' | 'components'> {
    children: string;
    resource: MarkdownEditingResource;
    baseVersion?: string;
    components?: Components;
    readOnly?: boolean;
    highlightChangesFrom?: string;
    highlightVersion?: number;
    onAction: (action: MarkdownEditingAction) => void | Promise<void>;
}

interface MarkdownBlockProps extends React.HTMLAttributes<HTMLElement> {
    node?: Element;
    children?: React.ReactNode;
}

type EditingMode = 'comment' | 'edit' | 'insert';

interface ActiveEditing {
    anchor: MarkdownBlockAnchor;
    mode: EditingMode;
    initialDraft?: string;
}

interface OrphanedDraft extends ActiveEditing {
    draft: string;
}

interface CollaborativeMarkdownContextValue {
    markdown: string;
    artifactRunId?: string;
    readOnly: boolean;
    activeEditing?: ActiveEditing;
    highlightChangesFrom?: string;
    flashChangedBlocks: boolean;
    beginEditing: (anchor: MarkdownBlockAnchor, mode: EditingMode, initialDraft?: string) => void;
    cancelEditing: () => void;
    updateDraft: (draft: string) => void;
    submit: (anchor: MarkdownBlockAnchor, mode: EditingMode, draft: string) => Promise<void>;
}

const CollaborativeMarkdownContext = createContext<CollaborativeMarkdownContextValue | null>(null);

/** True inside a selectable container block (list, blockquote, table). */
const NestedMarkdownBlockContext = createContext(false);

const MarkdownComponentEditor = lazy(() =>
    import('@vertesia/ui/rich-text').then((module) => ({ default: module.VertesiaMarkdownComponentEditor })),
);

const CONTEXT_LENGTH = 80;
const ATX_HEADING = /^ {0,3}(#{1,6})[\t ]+(.+?)[\t ]*#*[\t ]*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

function createOperationId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `edit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createMarkdownBlockLocator(
    markdown: string,
    node: Element | undefined,
    blockType: MarkdownBlockType,
): MarkdownBlockAnchor {
    const start = node?.position?.start.offset;
    const end = node?.position?.end.offset;
    const hasRange = typeof start === 'number' && typeof end === 'number' && start >= 0 && end >= start;
    const exactText = hasRange ? markdown.slice(start, end) : '';

    return {
        block_id: hasRange ? `${blockType}:${start}:${end}` : `${blockType}:${createOperationId()}`,
        block_type: blockType,
        ...(hasRange ? { source_range: { start, end } } : {}),
        exact_text: exactText,
        ...(hasRange && start > 0 ? { prefix: markdown.slice(Math.max(0, start - CONTEXT_LENGTH), start) } : {}),
        ...(hasRange && end < markdown.length
            ? { suffix: markdown.slice(end, Math.min(markdown.length, end + CONTEXT_LENGTH)) }
            : {}),
    };
}

function enrichMarkdownBlockAnchor(markdown: string, anchor: MarkdownBlockAnchor): MarkdownBlockAnchor {
    const start = anchor.source_range?.start;
    if (typeof start !== 'number') return anchor;
    const headingPath = getHeadingPath(markdown, start);
    const occurrenceIndex = getOccurrenceIndex(markdown, anchor.exact_text, start, headingPath);
    return {
        ...anchor,
        ...(headingPath.length > 0 ? { heading_path: headingPath } : {}),
        occurrence_index: occurrenceIndex,
    };
}

export function createMarkdownBlockAnchor(
    markdown: string,
    node: Element | undefined,
    blockType: MarkdownBlockType,
): MarkdownBlockAnchor {
    return enrichMarkdownBlockAnchor(markdown, createMarkdownBlockLocator(markdown, node, blockType));
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

/**
 * Apply a user edit to the markdown source. Returns the updated markdown, or
 * undefined when the anchored content cannot be located unambiguously.
 */
export function applyMarkdownEditingChange(markdown: string, action: MarkdownEditingAction): string | undefined {
    const change = action.user_change;
    if (!change) return undefined;
    const { before, after } = change;

    const range = action.anchor.source_range;
    if (range && markdown.slice(range.start, range.end) === before) {
        return markdown.slice(0, range.start) + after + markdown.slice(range.end);
    }

    const prefix = action.anchor.prefix;
    if (prefix) {
        const anchored = markdown.indexOf(prefix + before);
        if (anchored >= 0 && markdown.indexOf(prefix + before, anchored + 1) < 0) {
            const start = anchored + prefix.length;
            return markdown.slice(0, start) + after + markdown.slice(start + before.length);
        }
    }

    const first = markdown.indexOf(before);
    if (first < 0 || markdown.indexOf(before, first + 1) >= 0) return undefined;
    return markdown.slice(0, first) + after + markdown.slice(first + before.length);
}

export function formatMarkdownEditingAction(action: MarkdownEditingAction): string {
    const reference = resourceReference(action.resource);
    const location = action.anchor.block_type.replace('_', ' ');

    if (action.action === 'edit' && action.user_change && action.applied) {
        const fence = markdownFence(action.user_change.before, action.user_change.after);
        return [
            `I already edited the ${location} in ${reference} myself and the change is saved` +
                `${action.updated_document_id ? ` as revision ${action.updated_document_id}` : ''}.`,
            `Operation: ${action.operation_id}`,
            'This is a notification only. Do not apply this change again and do not modify the document in ' +
                'response; acknowledge briefly and use the latest content going forward.',
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

function CollaborativeBlockEditor({ anchor, mode, initialDraft }: ActiveEditing) {
    const { t } = useUITranslation();
    const { artifactRunId, readOnly, cancelEditing, submit, updateDraft } = useCollaborativeMarkdownContext();
    const [draft, setDraft] = useState(
        mode === 'edit' ? anchor.exact_text : mode === 'insert' ? (initialDraft ?? '') : '',
    );
    const [isSubmitting, setIsSubmitting] = useState(false);

    const changeDraft = (nextDraft: string) => {
        setDraft(nextDraft);
        updateDraft(nextDraft);
    };

    const submitDraft = async () => {
        if (!draft.trim() || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await submit(anchor, mode, mode === 'comment' ? draft.trim() : draft);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mb-2 space-y-2 rounded-md border border-mixer-info/30 bg-background p-2 shadow-sm">
            {mode === 'edit' || mode === 'insert' ? (
                <Suspense
                    fallback={
                        <Textarea
                            value={draft}
                            onChange={(event) => changeDraft(event.target.value)}
                            placeholder={t('agent.editSelectionPlaceholder')}
                            rows={6}
                            autoFocus
                        />
                    }
                >
                    <MarkdownComponentEditor
                        value={draft}
                        onChange={changeDraft}
                        artifactRunId={artifactRunId}
                        editable={!readOnly}
                        externalValueSync="manual"
                        autoFocus
                    />
                </Suspense>
            ) : (
                <Textarea
                    value={draft}
                    onChange={(event) => changeDraft(event.target.value)}
                    placeholder={t('agent.commentOnSelectionPlaceholder')}
                    rows={3}
                    autoFocus
                    disabled={readOnly}
                />
            )}
            <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={cancelEditing} disabled={isSubmitting}>
                    <X className="me-1 size-4" />
                    {t('store.cancelEdit')}
                </Button>
                <Button
                    size="sm"
                    onClick={() => void submitDraft()}
                    disabled={readOnly || !draft.trim() || isSubmitting}
                >
                    <Send className="me-1 size-4" />
                    {t('agent.send')}
                </Button>
            </div>
        </div>
    );
}

function createBlockComponent(
    tag: keyof React.JSX.IntrinsicElements,
    blockType: MarkdownBlockType,
    ExistingComponent: React.ElementType | undefined,
) {
    return function CollaborativeBlock({ node, children: blockChildren, ...props }: MarkdownBlockProps) {
        const { t } = useUITranslation();
        const { markdown, readOnly, activeEditing, highlightChangesFrom, flashChangedBlocks, beginEditing } =
            useCollaborativeMarkdownContext();
        const isNested = useContext(NestedMarkdownBlockContext);
        const rendered = ExistingComponent
            ? React.createElement(ExistingComponent, { node, ...props }, blockChildren)
            : React.createElement(tag, props, blockChildren);

        // Blocks inside a selectable container (a bullet's paragraph, a nested list, a
        // quoted paragraph) are edited through their container, not individually.
        if (isNested) return rendered;

        const anchor = createMarkdownBlockLocator(markdown, node, blockType);
        const isAnchorable = !readOnly && Boolean(anchor.source_range && anchor.exact_text);
        const isSelected = activeEditing?.anchor.block_id === anchor.block_id;
        const isChanged =
            flashChangedBlocks &&
            Boolean(anchor.exact_text) &&
            Boolean(highlightChangesFrom) &&
            !highlightChangesFrom?.includes(anchor.exact_text);
        const containerClassName = cn(
            'group/collab relative rounded-md border transition-colors duration-700',
            // Negative margins keep the document's flow spacing while giving the hover/selection box
            // padding on all sides — otherwise text (notably the first block, whose prose margin-top
            // is 0) sits flush against the top of its highlight box.
            '-mx-2 -my-1 px-2 py-1',
            isSelected
                ? 'border-info bg-mixer-info/5'
                : isAnchorable
                  ? 'border-transparent hover:border-mixer-info/30 hover:bg-mixer-muted/10'
                  : 'border-transparent',
            isChanged && 'border-mixer-success/50 bg-mixer-success/15 ring-1 ring-mixer-success/20',
        );
        const showControls = isAnchorable || isSelected;
        const controls = showControls ? (
            <>
                <div
                    className={cn(
                        'absolute end-1 top-1 z-10 flex items-center gap-0.5 rounded-md border bg-background p-0.5 shadow-sm',
                        !isAnchorable && 'hidden',
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
                    <DropdownMenu>
                        <VTooltip description={t('agent.insertComponent')} asChild>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    aria-label={t('agent.insertComponent')}
                                >
                                    <Plus className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                        </VTooltip>
                        <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => beginEditing(anchor, 'insert', t('richText.paragraph'))}>
                                <Pilcrow />
                                {t('richText.paragraph')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => beginEditing(anchor, 'insert', `## ${t('richText.heading2')}`)}
                            >
                                <Heading2 />
                                {t('richText.heading2')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => beginEditing(anchor, 'insert', `- ${t('richText.bulletList')}`)}
                            >
                                <List />
                                {t('richText.bulletList')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => beginEditing(anchor, 'insert', `> ${t('richText.blockquote')}`)}
                            >
                                <Quote />
                                {t('richText.blockquote')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => beginEditing(anchor, 'insert', '```\nCode\n```')}>
                                <Code2 />
                                {t('richText.codeBlock')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() =>
                                    beginEditing(anchor, 'insert', '| Column | Value |\n| --- | --- |\n| A | 1 |')
                                }
                            >
                                <Table2 />
                                {t('richText.table')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() =>
                                    beginEditing(anchor, 'insert', `[${t('agent.insertLink')}](https://example.com)`)
                                }
                            >
                                <Link />
                                {t('agent.insertLink')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() =>
                                    beginEditing(
                                        anchor,
                                        'insert',
                                        '```chart\n{"$schema":"https://vega.github.io/schema/vega-lite/v5.json","data":{"values":[{"category":"A","value":1}]},"mark":"bar","encoding":{"x":{"field":"category","type":"nominal"},"y":{"field":"value","type":"quantitative"}}}\n```',
                                    )
                                }
                            >
                                <BarChart3 />
                                {t('agent.insertChart')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                {isSelected && activeEditing ? (
                    <CollaborativeBlockEditor
                        key={`${activeEditing.anchor.block_id}:${activeEditing.mode}:${activeEditing.initialDraft ?? ''}`}
                        anchor={activeEditing.anchor}
                        mode={activeEditing.mode}
                        initialDraft={activeEditing.initialDraft}
                    />
                ) : null}
            </>
        ) : null;

        const content = CONTAINER_BLOCK_TYPES.has(blockType) ? (
            <NestedMarkdownBlockContext.Provider value={true}>{rendered}</NestedMarkdownBlockContext.Provider>
        ) : (
            rendered
        );

        return (
            <div className={containerClassName} data-collaborative-block={anchor.block_id}>
                {content}
                {controls}
            </div>
        );
    };
}

export function CollaborativeMarkdownRenderer({
    children: markdown,
    resource,
    baseVersion,
    artifactRunId,
    components,
    readOnly = false,
    highlightChangesFrom,
    highlightVersion = 0,
    onAction,
    className,
    ...markdownProps
}: CollaborativeMarkdownRendererProps) {
    const { t } = useUITranslation();
    const [activeEditing, setActiveEditing] = useState<ActiveEditing>();
    const [orphanedDraft, setOrphanedDraft] = useState<OrphanedDraft>();
    const [flashChangedBlocks, setFlashChangedBlocks] = useState(false);
    const draftRef = useRef('');

    useEffect(() => {
        if (!highlightChangesFrom || highlightVersion <= 0) return;
        setFlashChangedBlocks(true);
        const timeoutId = window.setTimeout(() => setFlashChangedBlocks(false), 1800);
        return () => window.clearTimeout(timeoutId);
    }, [highlightChangesFrom, highlightVersion]);

    useEffect(() => {
        const range = activeEditing?.anchor.source_range;
        if (!activeEditing || !range) return;
        if (markdown.slice(range.start, range.end) === activeEditing.anchor.exact_text) return;

        const draft = draftRef.current;
        const initialDraft =
            activeEditing.mode === 'edit'
                ? activeEditing.anchor.exact_text
                : activeEditing.mode === 'insert'
                  ? (activeEditing.initialDraft ?? '')
                  : '';
        if (draft.trim() && draft !== initialDraft) {
            setOrphanedDraft({ ...activeEditing, draft });
        }
        setActiveEditing(undefined);
    }, [activeEditing, markdown]);

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
            ul: createBlockComponent('ul', 'list', components?.ul as React.ElementType | undefined),
            ol: createBlockComponent('ol', 'list', components?.ol as React.ElementType | undefined),
            blockquote: createBlockComponent(
                'blockquote',
                'blockquote',
                components?.blockquote as React.ElementType | undefined,
            ),
            pre: createBlockComponent('pre', 'code_block', components?.pre as React.ElementType | undefined),
            table: createBlockComponent('table', 'table', components?.table as React.ElementType | undefined),
        };
    }, [components]);

    const beginEditing = useCallback(
        (anchor: MarkdownBlockAnchor, mode: EditingMode, initialDraft?: string) => {
            if (readOnly) return;
            const enrichedAnchor = enrichMarkdownBlockAnchor(markdown, anchor);
            draftRef.current = mode === 'edit' ? enrichedAnchor.exact_text : (initialDraft ?? '');
            setActiveEditing({ anchor: enrichedAnchor, mode, initialDraft });
        },
        [markdown, readOnly],
    );

    const cancelEditing = useCallback(() => {
        draftRef.current = '';
        setActiveEditing(undefined);
    }, []);

    const updateDraft = useCallback((draft: string) => {
        draftRef.current = draft;
    }, []);

    const submit = useCallback(
        async (anchor: MarkdownBlockAnchor, mode: EditingMode, draft: string) => {
            if (readOnly) return;
            const after = mode === 'insert' ? `${anchor.exact_text.replace(/\s+$/, '')}\n\n${draft.trim()}` : draft;
            const action: MarkdownEditingAction = {
                operation_id: createOperationId(),
                resource,
                base_version: baseVersion,
                action: mode === 'insert' ? 'edit' : mode,
                anchor,
                ...(mode === 'comment' ? { comment: draft } : { user_change: { before: anchor.exact_text, after } }),
            };

            await onAction(action);
            draftRef.current = '';
            setActiveEditing(undefined);
        },
        [baseVersion, onAction, readOnly, resource],
    );

    const contextValue = useMemo<CollaborativeMarkdownContextValue>(
        () => ({
            markdown,
            artifactRunId,
            readOnly,
            activeEditing,
            highlightChangesFrom,
            flashChangedBlocks,
            beginEditing,
            cancelEditing,
            updateDraft,
            submit,
        }),
        [
            activeEditing,
            artifactRunId,
            beginEditing,
            cancelEditing,
            flashChangedBlocks,
            highlightChangesFrom,
            markdown,
            readOnly,
            submit,
            updateDraft,
        ],
    );

    return (
        <CollaborativeMarkdownContext.Provider value={contextValue}>
            {orphanedDraft ? (
                <div className="not-prose mb-3 rounded-md border border-mixer-attention/35 bg-mixer-attention/10 p-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold text-foreground">
                                {t('agent.documentEditingDraftPreserved')}
                            </div>
                            <div className="mt-0.5 text-xs leading-4 text-muted">
                                {t('agent.documentEditingDraftPreservedDescription')}
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 shrink-0 p-0"
                            onClick={() => setOrphanedDraft(undefined)}
                            aria-label={t('agent.close')}
                        >
                            <X className="size-4" />
                        </Button>
                    </div>
                    <Textarea
                        className="mt-2"
                        value={orphanedDraft.draft}
                        onChange={(event) =>
                            setOrphanedDraft((current) =>
                                current ? { ...current, draft: event.target.value } : current,
                            )
                        }
                        rows={4}
                    />
                </div>
            ) : null}
            <MarkdownRenderer
                {...markdownProps}
                artifactRunId={artifactRunId}
                className={className}
                components={collaborativeComponents}
                preserveSourcePositions
            >
                {markdown}
            </MarkdownRenderer>
        </CollaborativeMarkdownContext.Provider>
    );
}
