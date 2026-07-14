import { cn } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import {
    diffWordSegments,
    type MarkdownBlockType,
    type MarkdownEditingAction,
    type MarkdownEditingResource,
} from '@vertesia/ui/widgets';
import { ChevronDown, ChevronRight, CircleCheck, FilePenLine, MessageSquareText, PencilLine } from 'lucide-react';
import { useMemo } from 'react';

const BLOCK_TYPES = new Set<MarkdownBlockType>([
    'heading',
    'paragraph',
    'list',
    'list_item',
    'blockquote',
    'code_block',
    'table',
]);

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function readString(record: Record<string, unknown> | undefined, key: string): string | undefined {
    const value = record?.[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parseResource(value: unknown): MarkdownEditingResource | undefined {
    const resource = asRecord(value);
    const kind = readString(resource, 'kind');
    if (kind === 'store_document') {
        const documentId = readString(resource, 'document_id');
        if (!documentId) return undefined;
        const name = readString(resource, 'name');
        return { kind, document_id: documentId, ...(name ? { name } : {}) };
    }
    if (kind === 'agent_artifact') {
        const runId = readString(resource, 'run_id');
        const path = readString(resource, 'path');
        return runId && path ? { kind, run_id: runId, path } : undefined;
    }
    return undefined;
}

export function parseMarkdownEditingAction(value: unknown): MarkdownEditingAction | undefined {
    const action = asRecord(value);
    const anchor = asRecord(action?.anchor);
    const operationId = readString(action, 'operation_id');
    const actionType = readString(action, 'action');
    const blockId = readString(anchor, 'block_id');
    const blockType = readString(anchor, 'block_type');
    const exactText = readString(anchor, 'exact_text');
    const resource = parseResource(action?.resource);
    if (
        !operationId ||
        (actionType !== 'comment' && actionType !== 'edit') ||
        !blockId ||
        !blockType ||
        !BLOCK_TYPES.has(blockType as MarkdownBlockType) ||
        !exactText ||
        !resource
    ) {
        return undefined;
    }

    const baseVersion = readString(action, 'base_version');
    const comment = readString(action, 'comment');
    const userChange = asRecord(action?.user_change);
    const before = readString(userChange, 'before');
    const after = readString(userChange, 'after');
    if (actionType === 'comment' && !comment) return undefined;
    if (actionType === 'edit' && (!before || !after)) return undefined;

    const updatedDocumentId = readString(action, 'updated_document_id');
    return {
        operation_id: operationId,
        resource,
        ...(baseVersion ? { base_version: baseVersion } : {}),
        action: actionType,
        anchor: {
            block_id: blockId,
            block_type: blockType as MarkdownBlockType,
            exact_text: exactText,
        },
        ...(comment ? { comment } : {}),
        ...(before && after ? { user_change: { before, after } } : {}),
        ...(action?.applied === true ? { applied: true } : {}),
        ...(updatedDocumentId ? { updated_document_id: updatedDocumentId } : {}),
    };
}

function shortenId(id: string): string {
    return id.length > 12 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
}

function resourceLabel(resource: MarkdownEditingResource): string {
    if (resource.kind === 'store_document') return resource.name || shortenId(resource.document_id);
    return resource.path;
}

function SourcePreview({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <pre
            className={cn(
                'm-0 max-h-32 overflow-auto whitespace-pre-wrap rounded-md border border-mixer-muted/20',
                'bg-background/55 px-2.5 py-2 font-mono text-xs leading-5 text-foreground/80',
                className,
            )}
        >
            {children}
        </pre>
    );
}

function ChangeDiff({ before, after }: { before: string; after: string }) {
    const segments = useMemo(() => diffWordSegments(before, after), [before, after]);
    return (
        <SourcePreview className="max-h-48">
            {segments.map((segment, index) => {
                if (segment.type === 'removed') {
                    return (
                        <del
                            key={index}
                            className="rounded-xs bg-mixer-destructive/15 text-destructive line-through decoration-destructive/50"
                        >
                            {segment.text}
                        </del>
                    );
                }
                if (segment.type === 'added') {
                    return (
                        <ins key={index} className="rounded-xs bg-mixer-success/15 text-success no-underline">
                            {segment.text}
                        </ins>
                    );
                }
                return <span key={index}>{segment.text}</span>;
            })}
        </SourcePreview>
    );
}

export function DocumentEditingActionCard({ action }: { action: MarkdownEditingAction }) {
    const { t } = useUITranslation();
    const isComment = action.action === 'comment';
    const isApplied = action.applied === true;
    const blockType = action.anchor.block_type.replaceAll('_', ' ');
    const Icon = isComment ? MessageSquareText : isApplied ? CircleCheck : PencilLine;

    return (
        <section
            aria-label={t('agent.documentEditCardTitle')}
            className={cn(
                'w-full min-w-0 overflow-hidden rounded-lg border text-start shadow-sm',
                isApplied ? 'border-mixer-success/25 bg-mixer-success/5' : 'border-mixer-info/20 bg-mixer-info/5',
            )}
            data-document-edit-action={action.action}
        >
            <div className="flex items-center gap-2 px-3 pb-1 pt-2.5">
                <span
                    className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-full',
                        isApplied ? 'bg-mixer-success/15 text-success' : 'bg-mixer-info/15 text-info',
                    )}
                >
                    <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-foreground">
                        {isComment
                            ? t('agent.documentEditCardComment')
                            : isApplied
                              ? t('agent.documentEditCardApplied')
                              : t('agent.documentEditCardDirectEdit')}
                    </div>
                    <div className="flex min-w-0 items-center gap-1 text-[11px] text-muted">
                        <FilePenLine className="size-3 shrink-0" aria-hidden="true" />
                        <span className="shrink-0 capitalize">{blockType}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{resourceLabel(action.resource)}</span>
                    </div>
                </div>
            </div>

            <div className="space-y-2.5 px-3 py-3">
                {isComment ? (
                    <p className="m-0 whitespace-pre-wrap text-sm leading-5 text-foreground">{action.comment}</p>
                ) : (
                    <ChangeDiff
                        before={action.user_change?.before ?? action.anchor.exact_text}
                        after={action.user_change?.after ?? ''}
                    />
                )}

                {isComment ? (
                    <details className="group">
                        <summary
                            className={cn(
                                'flex cursor-pointer select-none list-none items-center gap-1 rounded text-xs',
                                'font-medium text-muted transition-colors hover:text-foreground',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mixer-info/40',
                                '[&::-webkit-details-marker]:hidden',
                            )}
                        >
                            <ChevronRight
                                className="cn-rtl-flip size-3.5 shrink-0 group-open:hidden"
                                aria-hidden="true"
                            />
                            <ChevronDown className="hidden size-3.5 shrink-0 group-open:block" aria-hidden="true" />
                            {t('agent.documentEditCardSelectedContent')}
                        </summary>
                        <SourcePreview className="mt-1.5">{action.anchor.exact_text}</SourcePreview>
                    </details>
                ) : null}
            </div>
        </section>
    );
}
