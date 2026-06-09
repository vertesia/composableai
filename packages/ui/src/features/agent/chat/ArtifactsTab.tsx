import { Button, Center, ErrorBox, Input } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import {
    ChevronDownIcon,
    ChevronRightIcon,
    FileIcon,
    FolderIcon,
    FolderOpenIcon,
    Loader2Icon,
    PackageIcon,
    RefreshCwIcon,
    SearchIcon,
} from 'lucide-react';
import React, { useCallback, useId, useMemo, useState } from 'react';
import { type ArtifactTreeNode, useArtifacts } from './hooks/useArtifacts.js';

// ---------------------------------------------------------------------------
// Tree node component
// ---------------------------------------------------------------------------

interface TreeNodeProps {
    node: ArtifactTreeNode;
    depth: number;
    runId: string;
    onDownload: (relativePath: string) => void;
    downloadingPath: string | null;
    forceExpanded?: boolean;
}
//** Convert a raw directory segment (e.g. "out_files") into a readable label ("Out Files"). */
function formatDirectoryLabel(name: string): string {
    return name.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function TreeNode({ node, depth, runId, onDownload, downloadingPath, forceExpanded = false }: TreeNodeProps) {
    const [expanded, setExpanded] = useState(false);
    const isExpanded = forceExpanded || expanded;

    if (node.isDirectory) {
        return (
            <div>
                <Button
                    variant="unstyled"
                    className="flex items-center gap-1.5 w-full min-w-0 text-start py-1 px-1 rounded hover:bg-muted/30 text-sm"
                    style={{ paddingInlineStart: `${depth * 14 + 4}px` }}
                    onClick={() => setExpanded((prev) => !prev)}
                    aria-expanded={isExpanded}
                >
                    {isExpanded ? (
                        <ChevronDownIcon className="size-3.5 shrink-0 text-muted" />
                    ) : (
                        <ChevronRightIcon className="size-3.5 shrink-0 text-muted cn-rtl-flip" />
                    )}
                    {isExpanded ? (
                        <FolderOpenIcon className="size-4 shrink-0 text-info" />
                    ) : (
                        <FolderIcon className="size-4 shrink-0 text-info" />
                    )}
                    <span className="min-w-0 truncate font-medium" title={node.path}>
                        {formatDirectoryLabel(node.name)}
                    </span>
                </Button>
                {isExpanded &&
                    node.children.map((child) => (
                        <TreeNode
                            key={`${runId}:${child.path}`}
                            node={child}
                            depth={depth + 1}
                            runId={runId}
                            onDownload={onDownload}
                            downloadingPath={downloadingPath}
                            forceExpanded={forceExpanded}
                        />
                    ))}
            </div>
        );
    }

    const isDownloading = downloadingPath === node.path;

    return (
        <Button
            variant="unstyled"
            className="flex items-center gap-1.5 w-full min-w-0 text-start py-1 px-1 rounded hover:bg-muted/30 text-sm"
            style={{ paddingInlineStart: `${depth * 14 + 4}px` }}
            onClick={() => onDownload(node.path)}
            disabled={isDownloading}
            title={node.path}
        >
            {isDownloading ? (
                <Loader2Icon className="size-3.5 shrink-0 animate-spin text-info" />
            ) : (
                <span className="size-3.5 shrink-0" />
            )}
            <FileIcon className="size-4 shrink-0 text-muted" />
            <span className="min-w-0 truncate">{node.name}</span>
        </Button>
    );
}

function countTreeFiles(nodes: ArtifactTreeNode[]): number {
    return nodes.reduce((count, node) => {
        if (!node.isDirectory) {
            return count + 1;
        }
        return count + countTreeFiles(node.children);
    }, 0);
}

function filterArtifactTree(nodes: ArtifactTreeNode[], filter: string): ArtifactTreeNode[] {
    const normalizedFilter = filter.trim().toLocaleLowerCase();
    if (!normalizedFilter) {
        return nodes;
    }

    return nodes.flatMap((node) => {
        const matchesSelf = `${node.name} ${node.path}`.toLocaleLowerCase().includes(normalizedFilter);
        if (!node.isDirectory) {
            return matchesSelf ? [node] : [];
        }

        const matchingChildren = filterArtifactTree(node.children, normalizedFilter);
        if (matchesSelf) {
            return [{ ...node }];
        }
        if (matchingChildren.length > 0) {
            return [{ ...node, children: matchingChildren }];
        }
        return [];
    });
}

function downloadUrl(url: string, filename: string) {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener noreferrer';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
}

// ---------------------------------------------------------------------------
// Main tab component
// ---------------------------------------------------------------------------

interface ArtifactsTabProps {
    runId?: string;
    refreshKey?: number;
}

function ArtifactEmptyState({
    icon,
    children,
    action,
}: {
    icon?: React.ReactNode;
    children: React.ReactNode;
    action?: React.ReactNode;
}) {
    return (
        <Center className="h-full min-h-[240px] flex-col text-center text-muted">
            {icon}
            <span className="text-sm">{children}</span>
            {action}
        </Center>
    );
}

function ArtifactsTabComponent({ runId, refreshKey = 0 }: ArtifactsTabProps) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const { tree, flatFiles, isLoading, error, refresh } = useArtifacts(client, runId, refreshKey);
    const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
    const [filterValue, setFilterValue] = useState('');
    const normalizedFilterValue = filterValue.trim();
    const filteredTree = useMemo(() => filterArtifactTree(tree, normalizedFilterValue), [tree, normalizedFilterValue]);
    const visibleFileCount = useMemo(() => countTreeFiles(filteredTree), [filteredTree]);
    const filterInputId = useId();

    const handleDownload = useCallback(
        async (relativePath: string) => {
            if (!runId) return;
            setDownloadingPath(relativePath);
            try {
                const { url } = await client.files.getArtifactDownloadUrl(runId, relativePath, 'attachment');
                downloadUrl(url, relativePath.split('/').pop() || 'artifact');
            } catch (err) {
                console.error('Failed to get artifact download URL:', err);
            } finally {
                setDownloadingPath(null);
            }
        },
        [client, runId],
    );

    if (!runId) {
        return <ArtifactEmptyState icon={<PackageIcon className="mb-2 size-8" />}>No run selected</ArtifactEmptyState>;
    }

    if (isLoading && flatFiles.length === 0) {
        return (
            <ArtifactEmptyState icon={<Loader2Icon className="mb-2 size-6 animate-spin" />}>
                {t('agent.loadingArtifacts')}
            </ArtifactEmptyState>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-4 text-muted w-full">
                <ErrorBox
                    title="Fail to load Artifacts"
                    className="w-full"
                    action={refresh}
                    actionLabel={
                        <>
                            <RefreshCwIcon className="size-3.5 me-1.5" />
                            {t('agent.retry')}
                        </>
                    }
                >
                    <span className="break-all text-muted">{error}</span> <br />
                </ErrorBox>
            </div>
        );
    }

    if (flatFiles.length === 0) {
        return (
            <ArtifactEmptyState
                icon={<PackageIcon className="mb-2 size-8" />}
                action={
                    <Button variant="ghost" size="sm" className="mt-2" onClick={refresh}>
                        <RefreshCwIcon className="size-3.5 me-1.5" />
                        {t('agent.refresh')}
                    </Button>
                }
            >
                {t('agent.noArtifactsYet')}
            </ArtifactEmptyState>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Top bar */}
            <div className="flex shrink-0 flex-col gap-2 px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-xs text-muted">
                    <span>
                        {normalizedFilterValue
                            ? `${visibleFileCount} of ${flatFiles.length} file${flatFiles.length !== 1 ? 's' : ''}`
                            : `${flatFiles.length} file${flatFiles.length !== 1 ? 's' : ''}`}
                    </span>
                    <Button variant="ghost" size="sm" onClick={refresh} disabled={isLoading} className="h-6 w-6 p-0">
                        <RefreshCwIcon className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
                <div className="relative">
                    <label htmlFor={filterInputId} className="sr-only">
                        {t('form.filter')}
                    </label>
                    <SearchIcon className="pointer-events-none absolute start-2 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
                    <Input
                        id={filterInputId}
                        type="search"
                        placeholder={t('form.filter')}
                        value={filterValue}
                        onChange={setFilterValue}
                        className="h-8 ps-7 text-sm"
                    />
                </div>
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto px-2 pb-2">
                {filteredTree.length > 0 ? (
                    <div className="w-full">
                        {filteredTree.map((node) => (
                            <TreeNode
                                key={`${runId}:${node.path}`}
                                node={node}
                                depth={0}
                                runId={runId}
                                onDownload={handleDownload}
                                downloadingPath={downloadingPath}
                                forceExpanded={!!normalizedFilterValue}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="px-1 py-6 text-sm text-muted">{t('agent.noContentAvailable')}</div>
                )}
            </div>
        </div>
    );
}

export const ArtifactsTab = React.memo(ArtifactsTabComponent);
