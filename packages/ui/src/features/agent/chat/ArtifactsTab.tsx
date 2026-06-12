import { Button, Center, ErrorBox, Input, Modal, ModalBody, ModalTitle, Switch } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import {
    ChevronDownIcon,
    ChevronRightIcon,
    DownloadIcon,
    EyeIcon,
    FileIcon,
    FolderIcon,
    FolderOpenIcon,
    Loader2Icon,
    PackageIcon,
    RefreshCwIcon,
} from 'lucide-react';
import React, { useCallback, useId, useMemo, useState } from 'react';
import {
    type UniversalDocumentSource,
    UniversalDocumentViewer,
} from '../../document-viewer/UniversalDocumentViewer.js';
import { type ArtifactTreeNode, useArtifacts } from './hooks/useArtifacts.js';

// ---------------------------------------------------------------------------
// Tree node component
// ---------------------------------------------------------------------------

interface TreeNodeProps {
    node: ArtifactTreeNode;
    depth: number;
    runId: string;
    onPreview: (relativePath: string) => void;
    onDownload: (relativePath: string) => void;
    downloadingPath: string | null;
    forceExpanded?: boolean;
}

//** Convert a raw directory segment (e.g. "out_files") into a readable label ("Out Files"). */
function formatDirectoryLabel(name: string): string {
    return name.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function TreeNode({
    node,
    depth,
    runId,
    onPreview,
    onDownload,
    downloadingPath,
    forceExpanded = false,
}: TreeNodeProps) {
    const [expanded, setExpanded] = useState(false);
    const isExpanded = forceExpanded || expanded;

    if (node.isDirectory) {
        return (
            <div className="min-w-0">
                <Button
                    variant="unstyled"
                    className="flex w-full max-w-full items-center justify-start gap-1.5 rounded px-1 py-1 text-start text-sm hover:bg-muted/30"
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
                            onPreview={onPreview}
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
        <div
            className="group flex min-w-0 items-center gap-1.5 rounded text-sm hover:bg-muted/30"
            style={{ paddingInlineStart: `${depth * 14 + 4}px` }}
        >
            <Button
                variant="unstyled"
                className="flex min-w-0 flex-1 items-center justify-start gap-1.5 px-1 py-1 text-start"
                onClick={() => onPreview(node.path)}
                title={node.path}
            >
                <span className="size-3.5 shrink-0" />
                <FileIcon className="size-4 shrink-0 text-muted" />
                <span className="min-w-0 truncate">{node.name}</span>
            </Button>
            <div className="flex shrink-0 items-center pe-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <Button
                    variant="ghost"
                    size="xs"
                    className="h-6 w-6 p-0"
                    onClick={() => onPreview(node.path)}
                    aria-label="Preview artifact"
                >
                    <EyeIcon className="size-3.5" />
                </Button>
                <Button
                    variant="ghost"
                    size="xs"
                    className="h-6 w-6 p-0"
                    onClick={() => onDownload(node.path)}
                    disabled={isDownloading}
                    aria-label="Download artifact"
                >
                    {isDownloading ? (
                        <Loader2Icon className="size-3.5 animate-spin text-info" />
                    ) : (
                        <DownloadIcon className="size-3.5" />
                    )}
                </Button>
            </div>
        </div>
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

function getArtifactContentType(path: string): string | undefined {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'css':
            return 'text/css';
        case 'gif':
            return 'image/gif';
        case 'htm':
        case 'html':
            return 'text/html';
        case 'jpeg':
        case 'jpg':
            return 'image/jpeg';
        case 'json':
            return 'application/json';
        case 'md':
        case 'markdown':
            return 'text/markdown';
        case 'pdf':
            return 'application/pdf';
        case 'png':
            return 'image/png';
        case 'svg':
            return 'image/svg+xml';
        case 'ts':
        case 'tsx':
            return 'text/typescript';
        case 'txt':
            return 'text/plain';
        case 'webp':
            return 'image/webp';
        default:
            return undefined;
    }
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
    const [showSystem, setShowSystem] = useState(false);
    const { tree, flatFiles, totalCount, systemHiddenCount, isLoading, error, refresh } = useArtifacts(
        client,
        runId,
        refreshKey,
        showSystem,
    );
    const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
    const [previewPath, setPreviewPath] = useState<string | null>(null);
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

    const handlePreview = useCallback((relativePath: string) => {
        setPreviewPath(relativePath);
    }, []);

    const previewSource: UniversalDocumentSource | null =
        runId && previewPath
            ? {
                  title: previewPath.split('/').pop() || previewPath,
                  fileName: previewPath.split('/').pop() || previewPath,
                  contentType: getArtifactContentType(previewPath),
                  artifact: {
                      runId,
                      path: previewPath,
                  },
              }
            : null;

    if (!runId) {
        return <ArtifactEmptyState icon={<PackageIcon className="mb-2 size-8" />}>No run selected</ArtifactEmptyState>;
    }

    if (isLoading && totalCount === 0) {
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

    if (totalCount === 0) {
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
            <div className="flex shrink-0 flex-col gap-2 border-b px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-xs text-muted">
                    <span>
                        {normalizedFilterValue
                            ? `${visibleFileCount} of ${flatFiles.length} file${flatFiles.length !== 1 ? 's' : ''}`
                            : `${flatFiles.length} file${flatFiles.length !== 1 ? 's' : ''}`}
                        {!showSystem && systemHiddenCount > 0 ? ` · ${systemHiddenCount} hidden` : ''}
                    </span>
                    <div className="flex items-center gap-1">
                        <Switch size="sm" value={showSystem} onChange={setShowSystem}>
                            <span className="text-xs text-muted">{t('agent.showSystemArtifacts')}</span>
                        </Switch>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={refresh}
                            disabled={isLoading}
                            className="h-6 w-6 p-0"
                        >
                            <RefreshCwIcon className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>
                <label htmlFor={filterInputId} className="sr-only">
                    {t('form.filter')}
                </label>
                <Input
                    id={filterInputId}
                    type="text"
                    role="searchbox"
                    autoComplete="off"
                    placeholder={t('store.searchPlaceholder')}
                    value={filterValue}
                    onChange={setFilterValue}
                    clearable={true}
                />
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
                {filteredTree.length > 0 ? (
                    <div className="min-w-0">
                        {filteredTree.map((node) => (
                            <TreeNode
                                key={`${runId}:${node.path}`}
                                node={node}
                                depth={0}
                                runId={runId}
                                onPreview={handlePreview}
                                onDownload={handleDownload}
                                downloadingPath={downloadingPath}
                                forceExpanded={!!normalizedFilterValue}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="px-1 py-6 text-sm text-muted">
                        {!showSystem && systemHiddenCount > 0
                            ? t('agent.onlySystemArtifacts')
                            : t('agent.noContentAvailable')}
                    </div>
                )}
            </div>
            {previewSource && (
                <Modal
                    isOpen={!!previewPath}
                    onClose={() => setPreviewPath(null)}
                    size="xl"
                    className="h-[90vh] p-0"
                    description="Artifact preview"
                >
                    <ModalTitle show={false}>{previewSource.fileName}</ModalTitle>
                    <ModalBody className="h-full max-h-none p-0">
                        <UniversalDocumentViewer
                            source={previewSource}
                            className="h-full"
                            onDownload={() => previewPath && void handleDownload(previewPath)}
                        />
                    </ModalBody>
                </Modal>
            )}
        </div>
    );
}

export const ArtifactsTab = React.memo(ArtifactsTabComponent);
