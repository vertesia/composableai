import type { CanonicalInteractionOutputFragment } from '@vertesia/client';
import type { ConversationAgentContentBlock, ConversationAsset } from '@vertesia/common';
import { MessageBox } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { JSONCode, JSONDisplay, JSONSwitcher, MarkdownRenderer } from '@vertesia/ui/widgets';
import { useEffect, useState } from 'react';
import { AudioPanel } from '../media-viewer/AudioPanel.js';
import { VideoPanel } from '../media-viewer/VideoPanel.js';
import { canonicalAssetSource } from './canonicalOutput.js';

// Prose plugin defaults need explicit semantic colors in both themes, including nested table and code content.
const CANONICAL_PROSE_CLASS = [
    'vprose prose min-w-0 max-w-full text-sm leading-6 text-foreground',
    'prose-headings:text-foreground prose-strong:text-foreground prose-em:text-foreground',
    'prose-code:text-foreground prose-pre:text-foreground prose-pre:bg-muted',
    'prose-a:text-foreground prose-a:underline prose-a:underline-offset-4',
    'prose-blockquote:text-foreground/70 prose-blockquote:border-border',
    'prose-th:text-foreground prose-td:text-foreground prose-th:border-border prose-td:border-border',
    'prose-thead:border-border prose-tr:border-border prose-hr:border-border',
    '[&_p]:text-foreground [&_li]:text-foreground [&_li::marker]:text-foreground/70',
    '[&_blockquote_p]:text-foreground/70 [&_pre]:max-w-full [&_pre]:overflow-x-auto',
].join(' ');

export interface CanonicalOutputOptions {
    hideToolCalls?: boolean;
    artifactRunId?: string;
    onArtifactOpen?: (path: string) => void;
}
export interface CanonicalOutputBlocksProps extends CanonicalOutputOptions {
    blocks: readonly ConversationAgentContentBlock[];
    assets: Readonly<Record<string, Pick<ConversationAsset, 'storage' | 'mime_type' | 'media'>>>;
}

/** Render accepted canonical blocks directly, without converting them to legacy completion or agent-message shapes. */
export function CanonicalOutputBlocks({
    blocks,
    assets,
    artifactRunId,
    onArtifactOpen,
    hideToolCalls,
}: CanonicalOutputBlocksProps) {
    return (
        <div className="min-w-0 max-w-full space-y-3">
            {blocks
                .filter((block) => !hideToolCalls || block.type !== 'tool_call')
                .map((block) => (
                    <CanonicalOutputBlock
                        key={block.id}
                        block={block}
                        assets={assets}
                        artifactRunId={artifactRunId}
                        onArtifactOpen={onArtifactOpen}
                    />
                ))}
        </div>
    );
}

export function CanonicalAcceptedOutput({
    fragment,
    ...options
}: CanonicalOutputOptions & { fragment: CanonicalInteractionOutputFragment }) {
    return <CanonicalOutputBlocks blocks={fragment.turn.blocks} assets={fragment.assets} {...options} />;
}

function CanonicalOutputBlock({
    block,
    assets,
    artifactRunId,
    onArtifactOpen,
}: CanonicalOutputOptions & {
    block: ConversationAgentContentBlock;
    assets: Readonly<Record<string, Pick<ConversationAsset, 'storage' | 'mime_type' | 'media'>>>;
}) {
    const { t } = useUITranslation();

    if (block.type === 'text') {
        if (block.format === 'markdown')
            return (
                <MarkdownRenderer
                    className={`${CANONICAL_PROSE_CLASS} break-words [overflow-wrap:anywhere]`}
                    artifactRunId={artifactRunId}
                    onArtifactOpen={onArtifactOpen}
                >
                    {block.text}
                </MarkdownRenderer>
            );
        if (block.format === 'code') {
            // A fence longer than every source run keeps arbitrary code literal and bypasses special-language handlers.
            const longestFence = (block.text.match(/~+/g) ?? []).reduce(
                (length, run) => Math.max(length, run.length),
                3,
            );
            const fence = '~'.repeat(longestFence + 1);
            return (
                <MarkdownRenderer
                    className={CANONICAL_PROSE_CLASS}
                    preserveSourcePositions
                    codeClassName={block.language ? `language-${block.language}` : undefined}
                >
                    {`${fence}text\n${block.text}\n${fence}`}
                </MarkdownRenderer>
            );
        }
        return <pre className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{block.text}</pre>;
    }
    if (block.type === 'json') return <CanonicalJsonBlock value={block.value} />;
    if (block.type === 'reasoning') {
        return (
            <div className="rounded-md border border-mixer-muted/30 bg-mixer-muted/10 p-3 text-muted-foreground">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide">{t('canonicalOutput.reasoning')}</div>
                <pre className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{block.text}</pre>
            </div>
        );
    }
    if (block.type === 'tool_call') {
        return (
            <div className="rounded-md border border-border p-3">
                <div className="mb-2 text-sm font-medium">
                    {t('canonicalOutput.toolCall', { toolName: block.tool_name })}
                </div>
                <JSONCode data={block.arguments} />
            </div>
        );
    }
    if (block.type === 'external_reference') {
        return <MessageBox status="info">{block.preview ?? block.description}</MessageBox>;
    }
    if (block.type === 'native_replay') return null;
    if (block.type === 'extension') return <JSONCode data={block.payload} />;
    return <CanonicalMediaBlock block={block} asset={assets[block.asset_id]} />;
}

function CanonicalJsonBlock({ value }: { value: unknown }) {
    const { t } = useUITranslation();
    const [viewCode, setViewCode] = useState(false);
    return (
        <div className="flex flex-col">
            <div className="mb-2 flex shrink-0">
                <JSONSwitcher title={t('canonicalOutput.preview')} viewCode={viewCode} setViewCode={setViewCode} />
            </div>
            <JSONDisplay value={value} viewCode={viewCode} />
        </div>
    );
}

function CanonicalMediaBlock({
    block,
    asset,
}: {
    block: Extract<ConversationAgentContentBlock, { type: 'image' | 'document' | 'audio' | 'video' }>;
    asset: Pick<ConversationAsset, 'storage' | 'mime_type' | 'media'> | undefined;
}) {
    const { client } = useUserSession();
    const initialSource = canonicalAssetSource(asset);
    const needsResolution = /^(?:gs|s3):/.test(initialSource ?? '');
    const [resolved, setResolved] = useState<{
        client: typeof client;
        input: string;
        output: string;
    }>();
    const source = needsResolution
        ? resolved?.client === client && resolved.input === initialSource
            ? resolved.output
            : undefined
        : initialSource;
    const label = block.caption ?? block.type;

    useEffect(() => {
        if (!initialSource || !needsResolution) {
            setResolved(undefined);
            return;
        }
        let active = true;
        setResolved(undefined);
        void client.objects
            .getDownloadUrl(initialSource)
            .then((response) => {
                if (active) setResolved({ client, input: initialSource, output: response.url });
            })
            .catch(() => {
                if (active) setResolved(undefined);
            });
        return () => {
            active = false;
        };
    }, [client, initialSource, needsResolution]);

    if (!source) {
        return (
            <MessageBox status="info">
                {label}: {block.asset_id}
            </MessageBox>
        );
    }
    if (block.type === 'image') return <img src={source} alt={label} className="max-h-full max-w-full rounded-lg" />;
    if (block.type === 'video') return <VideoPanel url={source} className="max-w-full rounded-lg" />;
    if (block.type === 'audio') {
        return <AudioPanel url={source} media={asset?.media} className="max-w-full rounded-lg" />;
    }
    return (
        <a className="text-info-foreground underline" href={source} target="_blank" rel="noreferrer">
            {label}
        </a>
    );
}
