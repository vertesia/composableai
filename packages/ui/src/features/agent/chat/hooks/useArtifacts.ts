import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VertesiaClient } from '@vertesia/client';

// ---------------------------------------------------------------------------
// Tree node type
// ---------------------------------------------------------------------------

export interface ArtifactTreeNode {
    /** Display name — e.g. "out", "report.csv" */
    name: string;
    /** Full relative path from the run root — e.g. "out/subdir/report.csv" */
    path: string;
    isDirectory: boolean;
    children: ArtifactTreeNode[];
}

// ---------------------------------------------------------------------------
// Internal files we never show to the user
// ---------------------------------------------------------------------------

const INTERNAL_FILE_PATTERNS = [
    /conversation\.json$/,
    /-conversation\.json$/,
    /^tools\.json$/,
];

function isInternalFile(relativePath: string): boolean {
    const basename = relativePath.split('/').pop() ?? relativePath;
    return INTERNAL_FILE_PATTERNS.some((re) => re.test(basename));
}

// ---------------------------------------------------------------------------
// Build a tree from a flat list of relative paths
// ---------------------------------------------------------------------------

function buildTree(paths: string[]): ArtifactTreeNode[] {
    const root: ArtifactTreeNode = { name: '', path: '', isDirectory: true, children: [] };

    for (const p of paths) {
        const parts = p.split('/');
        let current = root;
        let accumulated = '';

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            accumulated = accumulated ? `${accumulated}/${part}` : part;
            const isLast = i === parts.length - 1;

            let child = current.children.find((c) => c.name === part);
            if (!child) {
                child = {
                    name: part,
                    path: accumulated,
                    isDirectory: !isLast,
                    children: [],
                };
                current.children.push(child);
            }
            current = child;
        }
    }

    // Sort: directories first, then alphabetical
    const sortChildren = (node: ArtifactTreeNode) => {
        node.children.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortChildren);
    };
    sortChildren(root);

    return root.children;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseArtifactsResult {
    tree: ArtifactTreeNode[];
    flatFiles: string[];
    isLoading: boolean;
    error: string | null;
    refresh: () => void;
}

export function useArtifacts(
    client: VertesiaClient,
    runId: string | undefined,
    refreshKey = 0,
): UseArtifactsResult {
    const [flatFiles, setFlatFiles] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [manualRefreshKey, setManualRefreshKey] = useState(0);
    const fetchIdRef = useRef(0);

    const fetchArtifacts = useCallback(async () => {
        if (!runId) return;

        const fetchId = ++fetchIdRef.current;
        setIsLoading(true);
        setError(null);

        try {
            const paths = await client.files.listArtifacts(runId);
            if (fetchId !== fetchIdRef.current) return; // stale

            const prefix = `agents/${runId}/`;
            const relatives = paths
                .map((p) => (p.startsWith(prefix) ? p.slice(prefix.length) : p.split('/').pop() ?? p))
                .filter((p) => p && !isInternalFile(p));

            setFlatFiles(relatives);
        } catch (err) {
            if (fetchId !== fetchIdRef.current) return;
            setError(err instanceof Error ? err.message : 'Failed to list artifacts');
            setFlatFiles([]);
        } finally {
            if (fetchId === fetchIdRef.current) {
                setIsLoading(false);
            }
        }
    }, [client, runId]);

    useEffect(() => {
        fetchArtifacts();
    }, [fetchArtifacts, refreshKey, manualRefreshKey]);

    const tree = useMemo(() => buildTree(flatFiles), [flatFiles]);

    const refresh = useCallback(() => {
        setManualRefreshKey((k) => k + 1);
    }, []);

    return { tree, flatFiles, isLoading, error, refresh };
}
