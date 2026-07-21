import { cn } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import type { MarkdownBlockType, MarkdownEditingAction, MarkdownEditingResource } from '@vertesia/ui/widgets';
import { CircleCheck, MessageSquareText, PencilLine } from 'lucide-react';
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
// block doesn't render as a full-size H1 inside a chat bubble, and trim the outer block margins.
const COMPACT_MARKDOWN_CLASS = [
    '[&_h1]:text-base [&_h2]:text-base [&_h3]:text-base [&_h4]:text-base [&_h5]:text-base [&_h6]:text-base',
    '[&_h1]:leading-snug [&_h2]:leading-snug [&_h3]:leading-snug',
    '[&_:first-child]:mt-0 [&_:last-child]:mb-0',
].join(' ');

export function DocumentEditingActionCard({ action }: { action: MarkdownEditingAction }) {
    const { t } = useUITranslation();
    const isComment = action.action === 'comment';
    const isApplied = action.applied === true;
    const blockType = action.anchor.block_type.replaceAll('_', ' ');
    const Icon = isComment ? MessageSquareText : isApplied ? CircleCheck : PencilLine;
    const artifactRunId = action.resource.kind === 'agent_artifact' ? action.resource.run_id : undefined;
    // The referenced block: what the comment is about, or the block's content after an edit.
    const referenceMarkdown = isComment
        ? action.anchor.exact_text
        : (action.user_change?.after ?? action.anchor.exact_text);

    return (
        <div className="min-w-0 space-y-2 text-start" data-document-edit-action={action.action}>
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
                <Icon className={cn('size-3.5 shrink-0', isApplied && 'text-success')} aria-hidden="true" />
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

            {isComment && action.comment ? (
                <CollapsibleAgentMarkdown artifactRunId={artifactRunId} className={COMPACT_MARKDOWN_CLASS}>
                    {action.comment}
                </CollapsibleAgentMarkdown>
            ) : null}

            <CollapsibleAgentMarkdown
                artifactRunId={artifactRunId}
                className={cn('border-s-2 border-mixer-muted/30 ps-3 text-foreground/70', COMPACT_MARKDOWN_CLASS)}
            >
                {referenceMarkdown}
            </CollapsibleAgentMarkdown>
        </div>
    );
}
