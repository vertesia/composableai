import { cn } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import {
    diffWordSegments,
    type MarkdownBlockType,
    type MarkdownEditingAction,
    type MarkdownEditingResource,
} from '@vertesia/ui/widgets';
import { MessageSquareText, PencilLine } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { CollapsibleAgentMarkdown } from './ModernAgentOutput/CollapsibleAgentMarkdown.js';

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

// A referenced block is a preview, not a document title — keep headings at body scale so a heading
// block doesn't render as a full-size H1, and trim the outer block margins.
const COMPACT_MARKDOWN_CLASS = [
    '[&_h1]:text-base [&_h2]:text-base [&_h3]:text-base [&_h4]:text-base [&_h5]:text-base [&_h6]:text-base',
    '[&_h1]:leading-snug [&_h2]:leading-snug [&_h3]:leading-snug',
    '[&_:first-child]:mt-0 [&_:last-child]:mb-0',
].join(' ');

function SourcePreview({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <pre
            className={cn(
                'm-0 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs leading-5 text-foreground/80',
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
        <SourcePreview>
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
    const Icon = isComment ? MessageSquareText : PencilLine;
    const artifactRunId = action.resource.kind === 'agent_artifact' ? action.resource.run_id : undefined;

    return (
        <div className="min-w-0 space-y-2 text-start" data-document-edit-action={action.action}>
            <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="shrink-0 font-medium text-foreground">
                    {isComment
                        ? t('agent.documentEditCardComment')
                        : isApplied
                          ? t('agent.documentEditCardApplied')
                          : t('agent.documentEditCardDirectEdit')}
                </span>
                <span aria-hidden="true">·</span>
                <span className="shrink-0 capitalize">{blockType}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{resourceLabel(action.resource)}</span>
            </div>

            {isComment ? (
                <>
                    {action.comment ? (
                        <CollapsibleAgentMarkdown
                            artifactRunId={artifactRunId}
                            disableCollapse
                            className={COMPACT_MARKDOWN_CLASS}
                        >
                            {action.comment}
                        </CollapsibleAgentMarkdown>
                    ) : null}
                    <CollapsibleAgentMarkdown
                        artifactRunId={artifactRunId}
                        disableCollapse
                        className={cn(
                            'border-s-2 border-mixer-muted/30 ps-3 text-foreground/70',
                            COMPACT_MARKDOWN_CLASS,
                        )}
                    >
                        {action.anchor.exact_text}
                    </CollapsibleAgentMarkdown>
                </>
            ) : (
                <ChangeDiff
                    before={action.user_change?.before ?? action.anchor.exact_text}
                    after={action.user_change?.after ?? ''}
                />
            )}
        </div>
    );
}
