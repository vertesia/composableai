import { Badge, cn } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import type { MarkdownBlockType, MarkdownEditingAction, MarkdownEditingResource } from '@vertesia/ui/widgets';
import { FilePenLine, MessageSquareText, PencilLine } from 'lucide-react';

const BLOCK_TYPES = new Set<MarkdownBlockType>([
    'heading',
    'paragraph',
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
    };
}

function resourceLabel(resource: MarkdownEditingResource): string {
    if (resource.kind === 'store_document') return resource.name || `store:${resource.document_id}`;
    return resource.path;
}

function SourcePreview({ children, className }: { children: string; className?: string }) {
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

export function DocumentEditingActionCard({ action }: { action: MarkdownEditingAction }) {
    const { t } = useUITranslation();
    const isComment = action.action === 'comment';
    const blockType = action.anchor.block_type.replaceAll('_', ' ');
    const Icon = isComment ? MessageSquareText : PencilLine;

    return (
        <section
            aria-label={t('agent.documentEditCardTitle')}
            className="w-full min-w-0 overflow-hidden rounded-xl border border-mixer-info/25 bg-mixer-info/5 text-start shadow-sm"
            data-document-edit-action={action.action}
        >
            <div className="flex items-center gap-2 border-b border-mixer-info/15 px-3 py-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-mixer-info/15 text-info">
                    <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-foreground">
                        {isComment ? t('agent.documentEditCardComment') : t('agent.documentEditCardDirectEdit')}
                    </div>
                    <div className="flex min-w-0 items-center gap-1 text-[11px] text-muted">
                        <FilePenLine className="size-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{resourceLabel(action.resource)}</span>
                    </div>
                </div>
                <Badge variant="outline" className="shrink-0 capitalize">
                    {blockType}
                </Badge>
            </div>

            <div className="space-y-2.5 px-3 py-3">
                {isComment ? (
                    <p className="m-0 whitespace-pre-wrap text-sm leading-5 text-foreground">{action.comment}</p>
                ) : (
                    <div className="space-y-2">
                        <div>
                            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                                {t('agent.documentEditCardBefore')}
                            </div>
                            <SourcePreview className="border-mixer-destructive/20 bg-mixer-destructive/5">
                                {action.user_change?.before ?? action.anchor.exact_text}
                            </SourcePreview>
                        </div>
                        <div>
                            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                                {t('agent.documentEditCardAfter')}
                            </div>
                            <SourcePreview className="border-mixer-success/25 bg-mixer-success/5">
                                {action.user_change?.after ?? ''}
                            </SourcePreview>
                        </div>
                    </div>
                )}

                {isComment ? (
                    <details className="group rounded-md border border-mixer-muted/20 bg-background/35 px-2.5 py-2">
                        <summary className="cursor-pointer select-none text-xs font-medium text-muted hover:text-foreground">
                            {t('agent.documentEditCardSelectedContent')}
                        </summary>
                        <SourcePreview className="mt-2 border-0 bg-background/70">
                            {action.anchor.exact_text}
                        </SourcePreview>
                    </details>
                ) : null}
            </div>
        </section>
    );
}
