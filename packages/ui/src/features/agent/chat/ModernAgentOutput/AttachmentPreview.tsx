import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import { Button, cn } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { UserSessionContext } from '@vertesia/ui/session';
import { ChevronDown, FileTextIcon, ImageIcon, XIcon } from 'lucide-react';
import type React from 'react';
import { useContext, useEffect, useId, useState } from 'react';
import { useImageLightbox } from '../ImageLightbox';
import { getArtifactCacheKey, useArtifactUrlCache } from '../useArtifactUrlCache';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);
const TEXT_EXTENSIONS = new Set([
    'css',
    'csv',
    'html',
    'js',
    'json',
    'jsx',
    'log',
    'md',
    'mjs',
    'sql',
    'ts',
    'tsx',
    'txt',
    'xml',
    'yaml',
    'yml',
]);
const DEFAULT_COLLAPSED_ATTACHMENT_COUNT = 3;

export interface AttachmentPreviewItem {
    id: string;
    name: string;
    contentType?: string;
    href?: string;
    artifactPath?: string;
    previewUrl?: string;
    removable?: boolean;
    statusLabel?: string;
    statusTone?: 'success' | 'attention' | 'destructive' | 'info' | 'muted';
}

export interface ParsedUserAttachments {
    body: string;
    attachments: AttachmentPreviewItem[];
}

interface AttachmentPreviewListProps {
    items: AttachmentPreviewItem[];
    artifactRunId?: string;
    onOpenArtifact?: (path: string) => void;
    className?: string;
    align?: 'start' | 'end';
    variant?: 'composer' | 'message';
    onRemove?: (fileId: string) => void;
    StoreLinkComponent?: React.ComponentType<{ href: string; documentId: string; children: React.ReactNode }>;
    CollectionLinkComponent?: React.ComponentType<{ href: string; collectionId: string; children: React.ReactNode }>;
}

function getFileExtension(nameOrPath: string | undefined): string {
    const value = nameOrPath?.split(/[?#]/)[0] ?? '';
    return value.includes('.') ? (value.split('.').pop() ?? '').toLowerCase() : '';
}

function isImageAttachment(item: AttachmentPreviewItem): boolean {
    if (item.contentType?.toLowerCase().startsWith('image/')) return true;
    return IMAGE_EXTENSIONS.has(getFileExtension(item.artifactPath || item.href || item.name));
}

function isTextLikeAttachment(item: AttachmentPreviewItem): boolean {
    const contentType = item.contentType?.toLowerCase() ?? '';
    if (contentType.startsWith('text/')) return true;
    if (contentType === 'application/json' || contentType.includes('xml')) return true;
    return TEXT_EXTENSIONS.has(getFileExtension(item.artifactPath || item.href || item.name));
}

function getArtifactPath(item: AttachmentPreviewItem): string | undefined {
    if (item.artifactPath) return item.artifactPath;
    if (item.href?.startsWith('artifact:')) return item.href.slice('artifact:'.length);
    return undefined;
}

function getStoreObjectId(href: string): string {
    const pathId = href.split('/store/objects/')[1];
    if (pathId) return pathId.split(/[?#]/)[0];

    return href
        .replace(/^store:/, '')
        .replace(/^document:(?:\/\/)?/, '')
        .split(/[?#]/)[0];
}

function getCollectionId(href: string): string {
    return href.split('/store/collections/')[1] || href.replace(/^collection:/, '');
}

function isStoreObjectHref(href: string | undefined): boolean {
    return Boolean(href?.includes('/store/objects/') || href?.startsWith('store:') || href?.startsWith('document:'));
}

function isCollectionHref(href: string | undefined): boolean {
    return Boolean(href?.includes('/store/collections/') || href?.startsWith('collection:'));
}

function AttachmentLink({
    item,
    children,
    onOpenArtifact,
    StoreLinkComponent,
    CollectionLinkComponent,
}: {
    item: AttachmentPreviewItem;
    children: React.ReactNode;
    onOpenArtifact?: (path: string) => void;
    StoreLinkComponent?: AttachmentPreviewListProps['StoreLinkComponent'];
    CollectionLinkComponent?: AttachmentPreviewListProps['CollectionLinkComponent'];
}) {
    const href = item.href;
    if (!href) return <>{children}</>;

    const artifactPath = getArtifactPath(item);
    if (artifactPath && /\.md$/i.test(artifactPath) && onOpenArtifact) {
        return (
            <button type="button" className="max-w-full text-start" onClick={() => onOpenArtifact(artifactPath)}>
                {children}
            </button>
        );
    }

    if (isStoreObjectHref(href)) {
        const documentId = getStoreObjectId(href);
        if (StoreLinkComponent) {
            return (
                <StoreLinkComponent href={href} documentId={documentId}>
                    {children}
                </StoreLinkComponent>
            );
        }
        return (
            <a href={href.startsWith('store:') || href.startsWith('document:') ? `/store/objects/${documentId}` : href}>
                {children}
            </a>
        );
    }

    if (isCollectionHref(href)) {
        const collectionId = getCollectionId(href);
        if (CollectionLinkComponent) {
            return (
                <CollectionLinkComponent href={href} collectionId={collectionId}>
                    {children}
                </CollectionLinkComponent>
            );
        }
        return <a href={href.startsWith('collection:') ? `/store/collections/${collectionId}` : href}>{children}</a>;
    }

    if (/^https?:\/\//.test(href) || href.startsWith('/')) {
        return (
            <a href={href} target={href.startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer">
                {children}
            </a>
        );
    }

    return <>{children}</>;
}

function AttachmentPreview({
    item,
    artifactRunId,
    variant,
    onRemove,
    onOpenArtifact,
    StoreLinkComponent,
    CollectionLinkComponent,
}: {
    item: AttachmentPreviewItem;
    artifactRunId?: string;
    variant: 'composer' | 'message';
    onRemove?: (fileId: string) => void;
    onOpenArtifact?: (path: string) => void;
    StoreLinkComponent?: AttachmentPreviewListProps['StoreLinkComponent'];
    CollectionLinkComponent?: AttachmentPreviewListProps['CollectionLinkComponent'];
}) {
    const { t } = useUITranslation();
    const session = useContext(UserSessionContext);
    const urlCache = useArtifactUrlCache();
    const { openImage } = useImageLightbox();
    const artifactPath = getArtifactPath(item);
    const isImage = isImageAttachment(item);
    const shouldRenderThumbnail = isImage && !isTextLikeAttachment(item);
    const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(item.previewUrl);

    useEffect(() => {
        setResolvedUrl(item.previewUrl);
    }, [item.previewUrl]);

    useEffect(() => {
        if (!shouldRenderThumbnail || item.previewUrl || !artifactRunId || !artifactPath || !session?.client) {
            return;
        }

        let cancelled = false;
        const cacheKey = getArtifactCacheKey(artifactRunId, artifactPath, 'inline');
        const fetchUrl = async () => {
            const url = urlCache
                ? await urlCache.getOrFetch(cacheKey, async () => {
                      const result = await session.client.files.getArtifactDownloadUrl(
                          artifactRunId,
                          artifactPath,
                          'inline',
                      );
                      return result.url;
                  })
                : (await session.client.files.getArtifactDownloadUrl(artifactRunId, artifactPath, 'inline')).url;

            if (!cancelled) setResolvedUrl(url);
        };

        void fetchUrl().catch(() => {
            if (!cancelled) setResolvedUrl(undefined);
        });

        return () => {
            cancelled = true;
        };
    }, [artifactPath, artifactRunId, item.previewUrl, session?.client, shouldRenderThumbnail, urlCache]);

    const statusClassName = {
        attention: 'bg-attention/15 text-attention',
        destructive: 'bg-destructive/15 text-destructive',
        info: 'bg-info/15 text-info',
        muted: 'bg-muted text-muted',
        success: 'bg-success/15 text-success',
    }[item.statusTone ?? 'muted'];

    const canRemove = Boolean(onRemove && item.removable !== false);
    const handleRemove = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        event.preventDefault();
        onRemove?.(item.id);
    };
    const removeButton = canRemove ? (
        <Button
            variant="unstyled"
            size="none"
            aria-label={t('agent.removeFile', { name: item.name })}
            onClick={handleRemove}
            className={cn(
                'absolute -end-1.5 -top-1.5 inline-flex size-5 items-center justify-center rounded-full',
                'border border-border bg-background text-muted shadow-sm transition-colors hover:text-foreground',
            )}
        >
            <XIcon className="size-3" aria-hidden="true" />
        </Button>
    ) : null;
    const inlineRemoveButton = canRemove ? (
        <Button
            variant="unstyled"
            size="none"
            aria-label={t('agent.removeFile', { name: item.name })}
            onClick={handleRemove}
            className={cn(
                '-me-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted',
                'transition-colors hover:bg-mixer-muted/30 hover:text-foreground',
            )}
        >
            <XIcon className="size-3.5" aria-hidden="true" />
        </Button>
    ) : null;

    const attachmentIcon =
        shouldRenderThumbnail && resolvedUrl ? (
            <Button
                type="button"
                variant="unstyled"
                size="none"
                onClick={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    openImage(resolvedUrl, item.name);
                }}
                aria-label={item.name}
                title={t('agent.enlargedView')}
                className={cn(
                    'group shrink-0 overflow-hidden rounded border border-border/60 p-0',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    variant === 'composer' ? 'size-6' : 'size-24',
                )}
            >
                <img
                    src={resolvedUrl}
                    alt={item.name}
                    className="h-full w-full object-cover transition-transform group-hover:scale-[1.05]"
                />
            </Button>
        ) : isImage ? (
            <ImageIcon className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
        ) : (
            <FileTextIcon className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
        );
    const attachmentLabel = (
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
            {attachmentIcon}
            <span className={cn('truncate', variant === 'composer' ? 'max-w-[14rem]' : 'max-w-[16rem]')}>
                {item.name}
            </span>
            {item.statusLabel ? (
                <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', statusClassName)}>
                    {item.statusLabel}
                </span>
            ) : null}
        </span>
    );

    if (variant === 'composer') {
        return (
            <span
                title={item.name}
                className={cn(
                    'inline-flex min-h-8 max-w-full items-center gap-1 rounded-xl border border-border/60',
                    'bg-mixer-muted/15 px-2.5 py-1 text-sm text-foreground/80 transition-colors',
                    item.href && 'hover:bg-mixer-muted/25',
                )}
            >
                <AttachmentLink
                    item={item}
                    StoreLinkComponent={StoreLinkComponent}
                    CollectionLinkComponent={CollectionLinkComponent}
                >
                    {attachmentLabel}
                </AttachmentLink>
                {inlineRemoveButton}
            </span>
        );
    }

    const chipContent = (
        <span
            title={item.name}
            className={cn(
                'inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/60 bg-mixer-muted/15',
                'px-2.5 py-1.5 text-xs text-foreground/80 transition-colors',
                item.href && 'hover:bg-mixer-muted/25',
            )}
        >
            {attachmentLabel}
        </span>
    );

    return (
        <span className="relative inline-flex max-w-full">
            <AttachmentLink
                item={item}
                onOpenArtifact={onOpenArtifact}
                StoreLinkComponent={StoreLinkComponent}
                CollectionLinkComponent={CollectionLinkComponent}
            >
                {chipContent}
            </AttachmentLink>
            {removeButton}
        </span>
    );
}

export function AttachmentPreviewList({
    items,
    artifactRunId,
    className,
    align = 'start',
    variant = 'message',
    onRemove,
    onOpenArtifact,
    StoreLinkComponent,
    CollectionLinkComponent,
}: AttachmentPreviewListProps) {
    const { t } = useUITranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    const attachmentListId = useId();
    const isCollapsible = variant === 'composer' && items.length > DEFAULT_COLLAPSED_ATTACHMENT_COUNT;
    const visibleItems = isCollapsible && !isExpanded ? items.slice(0, DEFAULT_COLLAPSED_ATTACHMENT_COUNT) : items;
    const hiddenItemCount = items.length - DEFAULT_COLLAPSED_ATTACHMENT_COUNT;

    useEffect(() => {
        if (items.length <= DEFAULT_COLLAPSED_ATTACHMENT_COUNT) {
            setIsExpanded(false);
        }
    }, [items.length]);

    if (items.length === 0) return null;

    return (
        <div id={attachmentListId} className={cn('flex flex-wrap gap-2', align === 'end' && 'justify-end', className)}>
            {visibleItems.map((item) => (
                <AttachmentPreview
                    key={item.id}
                    item={item}
                    artifactRunId={artifactRunId}
                    variant={variant}
                    onRemove={onRemove}
                    onOpenArtifact={onOpenArtifact}
                    StoreLinkComponent={StoreLinkComponent}
                    CollectionLinkComponent={CollectionLinkComponent}
                />
            ))}
            {isCollapsible && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-controls={attachmentListId}
                    aria-expanded={isExpanded}
                    onClick={() => setIsExpanded((expanded) => !expanded)}
                    className="h-8 shrink-0 gap-1 rounded-xl px-2.5 text-xs text-muted"
                >
                    {!isExpanded && <span>+{hiddenItemCount}</span>}
                    {isExpanded ? t('agent.showLess') : t('agent.showMore')}
                    <ChevronDown
                        className={cn('size-3.5 transition-transform', isExpanded && 'rotate-180')}
                        aria-hidden="true"
                    />
                </Button>
            )}
        </div>
    );
}

const ATTACHMENT_SECTION_RE = /^\s*(?:\*\*)?(attachments|uploaded artifacts):(?:\*\*)?\s*$/i;

const SINGLE_WHITESPACE_RE = /\s/;

/** The only note shapes the server-side formatter emits (see processUserMessages). */
const ATTACHMENT_NOTE_PREFIXES = ['image -', 'text extracted to '];

interface AttachmentLineParts {
    name: string;
    href: string;
    note?: string;
}

/**
 * Parse one attachment line of the form `- [label](href)` or `- [label](href) (note)`.
 *
 * Hrefs mirror user filenames, so they can contain parentheses and spaces
 * ("artifact:files/report (6).json"), and workflow-composed lines append a parenthesized note
 * ("(image - ...)", "(text extracted to ...)") that can itself contain parentheses. A regex for
 * that shape needs overlapping greedy captures, which backtrack polynomially on message content
 * (CodeQL js/polynomial-redos) — so the line is split with a linear scan instead: the label runs
 * to the first "]", and the note starts at the rightmost "(" that is preceded by whitespace and
 * a ")" AND opens one of the known note shapes. Requiring a known prefix is what keeps a
 * note-less filename such as "a (b) (c).pdf" from being split at its own parentheses.
 */
function parseAttachmentLine(trimmed: string): AttachmentLineParts | null {
    let text = trimmed;
    if (text.startsWith('-') || text.startsWith('*')) {
        text = text.slice(1).trimStart();
    }
    if (!text.startsWith('[') || !text.endsWith(')')) return null;
    const labelEnd = text.indexOf(']');
    if (labelEnd < 2 || text[labelEnd + 1] !== '(') return null;
    const name = text.slice(1, labelEnd);
    // Everything between "](" and the final ")": either the whole href, or "href) (note".
    const body = text.slice(labelEnd + 2, -1);
    for (let open = body.lastIndexOf('('); open > 0; open = body.lastIndexOf('(', open - 1)) {
        let wsStart = open;
        while (wsStart > 0 && SINGLE_WHITESPACE_RE.test(body[wsStart - 1])) {
            wsStart--;
        }
        if (wsStart === open || wsStart < 2 || body[wsStart - 1] !== ')') continue;
        const note = body.slice(open + 1);
        if (!ATTACHMENT_NOTE_PREFIXES.some((prefix) => note.startsWith(prefix))) continue;
        return { name, href: body.slice(0, wsStart - 1), note };
    }
    return body ? { name, href: body } : null;
}

export function parseUserMessageAttachments(content: string): ParsedUserAttachments {
    const lines = content.split(/\r?\n/);
    const bodyLines: string[] = [];
    const attachments: AttachmentPreviewItem[] = [];
    let inAttachmentSection = false;

    for (const line of lines) {
        const trimmed = line.trim();

        if (ATTACHMENT_SECTION_RE.test(trimmed)) {
            inAttachmentSection = true;
            continue;
        }

        if (!inAttachmentSection) {
            bodyLines.push(line);
            continue;
        }

        if (!trimmed) {
            continue;
        }

        const parsed = parseAttachmentLine(trimmed);
        if (!parsed) {
            inAttachmentSection = false;
            bodyLines.push(line);
            continue;
        }

        const { name, href, note } = parsed;
        const artifactPath = href.startsWith('artifact:') ? href.slice('artifact:'.length) : undefined;
        attachments.push({
            id: `${href}-${attachments.length}`,
            name,
            href,
            artifactPath,
            contentType: note?.toLowerCase().includes('image') ? 'image/*' : undefined,
        });
    }

    return {
        body: bodyLines.join('\n').trim(),
        attachments,
    };
}

/**
 * Collect the artifact references (`artifact:...` hrefs and bare artifact paths) embedded in
 * sent user messages. A file whose reference appears here has already been delivered to the
 * agent, so the composer must not offer it as a pending attachment again (e.g. after a reload).
 */
export function collectDeliveredArtifactRefs(messages: AgentMessage[]): Set<string> {
    const refs = new Set<string>();
    for (const message of messages) {
        // Only persisted server echoes prove delivery. Optimistic messages can still be sending
        // or can fail, in which case suppressing their files would prevent a retry.
        if (
            message.type !== AgentMessageType.QUESTION ||
            message.details?._optimistic ||
            typeof message.message !== 'string'
        ) {
            continue;
        }
        for (const attachment of parseUserMessageAttachments(message.message).attachments) {
            if (attachment.href) refs.add(attachment.href);
            if (attachment.artifactPath) refs.add(attachment.artifactPath);
        }
    }
    return refs;
}
