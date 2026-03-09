import React, { useCallback, useState } from 'react';
import {
    ChevronDownIcon,
    ChevronRightIcon,
    FileIcon,
    FolderIcon,
    FolderOpenIcon,
    Loader2Icon,
    PackageIcon,
    RefreshCwIcon,
} from 'lucide-react';
import { Button } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';
import { useArtifacts, type ArtifactTreeNode } from './hooks/useArtifacts.js';

// ---------------------------------------------------------------------------
// Tree node component
// ---------------------------------------------------------------------------

interface TreeNodeProps {
    node: ArtifactTreeNode;
    depth: number;
    runId: string;
    onDownload: (relativePath: string) => void;
    downloadingPath: string | null;
}

function TreeNode({ node, depth, runId, onDownload, downloadingPath }: TreeNodeProps) {
    const [expanded, setExpanded] = useState(true);

    if (node.isDirectory) {
        return (
            <div>
                <button
                    className="flex items-center gap-1.5 w-full text-left py-1 px-1 rounded hover:bg-muted/30 text-sm"
                    style={{ paddingLeft: `${depth * 16 + 4}px` }}
                    onClick={() => setExpanded((prev) => !prev)}
                >
                    {expanded
                        ? <ChevronDownIcon className="size-3.5 shrink-0 text-muted" />
                        : <ChevronRightIcon className="size-3.5 shrink-0 text-muted" />}
                    {expanded
                        ? <FolderOpenIcon className="size-4 shrink-0 text-info" />
                        : <FolderIcon className="size-4 shrink-0 text-info" />}
                    <span className="truncate font-medium">{node.name}</span>
                </button>
                {expanded && node.children.map((child) => (
                    <TreeNode
                        key={child.path}
                        node={child}
                        depth={depth + 1}
                        runId={runId}
                        onDownload={onDownload}
                        downloadingPath={downloadingPath}
                    />
                ))}
            </div>
        );
    }

    const isDownloading = downloadingPath === node.path;

    return (
        <button
            className="flex items-center gap-1.5 w-full text-left py-1 px-1 rounded hover:bg-muted/30 text-sm"
            style={{ paddingLeft: `${depth * 16 + 4}px` }}
            onClick={() => onDownload(node.path)}
            disabled={isDownloading}
        >
            {isDownloading
                ? <Loader2Icon className="size-3.5 shrink-0 animate-spin text-info" />
                : <span className="size-3.5 shrink-0" />}
            <FileIcon className="size-4 shrink-0 text-muted" />
            <span className="truncate">{node.name}</span>
        </button>
    );
}

// ---------------------------------------------------------------------------
// Main tab component
// ---------------------------------------------------------------------------

interface ArtifactsTabProps {
    runId?: string;
    refreshKey?: number;
}

function ArtifactsTabComponent({ runId, refreshKey = 0 }: ArtifactsTabProps) {
    const { client } = useUserSession();
    const { tree, flatFiles, isLoading, error, refresh } = useArtifacts(client, runId, refreshKey);
    const [downloadingPath, setDownloadingPath] = useState<string | null>(null);

    const handleDownload = useCallback(async (relativePath: string) => {
        if (!runId) return;
        setDownloadingPath(relativePath);
        try {
            const { url } = await client.files.getArtifactDownloadUrl(runId, relativePath, 'attachment');
            window.open(url, '_blank');
        } catch (err) {
            console.error('Failed to get artifact download URL:', err);
        } finally {
            setDownloadingPath(null);
        }
    }, [client, runId]);

    if (!runId) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-muted">
                <PackageIcon className="size-8 mb-2" />
                <span className="text-sm">No run selected</span>
            </div>
        );
    }

    if (isLoading && flatFiles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-muted">
                <Loader2Icon className="size-6 animate-spin mb-2" />
                <span className="text-sm">Loading artifacts...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-muted">
                <span className="text-sm text-destructive mb-2">{error}</span>
                <Button variant="ghost" size="sm" onClick={refresh}>
                    <RefreshCwIcon className="size-3.5 mr-1.5" />
                    Retry
                </Button>
            </div>
        );
    }

    if (flatFiles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-muted">
                <PackageIcon className="size-8 mb-2" />
                <span className="text-sm">No artifacts yet</span>
                <Button variant="ghost" size="sm" className="mt-2" onClick={refresh}>
                    <RefreshCwIcon className="size-3.5 mr-1.5" />
                    Refresh
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Top bar */}
            <div className="flex items-center justify-between px-3 py-2 border-b text-xs text-muted">
                <span>
                    {flatFiles.length} file{flatFiles.length !== 1 ? 's' : ''}
                </span>
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

            {/* Tree */}
            <div className="flex-1 overflow-y-auto p-2">
                {tree.map((node) => (
                    <TreeNode
                        key={node.path}
                        node={node}
                        depth={0}
                        runId={runId}
                        onDownload={handleDownload}
                        downloadingPath={downloadingPath}
                    />
                ))}
            </div>
        </div>
    );
}

export const ArtifactsTab = React.memo(ArtifactsTabComponent);
