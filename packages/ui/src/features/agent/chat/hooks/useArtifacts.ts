import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { VertesiaClient } from '@vertesia/client';

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
// System artifacts — agent execution internals (tool I/O hydration,
// conversation snapshots, process state, archives). Hidden by default and
// revealed via the "Show system files" toggle.
// ---------------------------------------------------------------------------

// Matched against the run-relative path: any path with one of these directory
// segments is agent scaffolding rather than a user-facing output.
const SYSTEM_DIR_PATTERN = /(^|\/)(tool-inputs|tool-results|archive)(\/|$)/;
const SYSTEM_PROCESS_PATTERN = /(^|\/)process\/(history|state)(\/|$)/;

// Matched against the file basename.
const SYSTEM_BASENAME_PATTERNS = [
    /conversation\.json$/, // conversation.json, <id>-conversation.json
    /^conversation-checkpoint-\d+\.json$/,
    /^tools\.json$/,
    /^tool-input-refs\.json$/,
    /^toolu[_-]/i, // per-tool-use input/result hydration payloads
];

export function isSystemArtifact(relativePath: string): boolean {
    if (SYSTEM_DIR_PATTERN.test(relativePath) || SYSTEM_PROCESS_PATTERN.test(relativePath)) {
        return true;
    }
    const basename = relativePath.split('/').pop() ?? relativePath;
    return SYSTEM_BASENAME_PATTERNS.some((re) => re.test(basename));
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

/**
 * Extract the run-relative path from an artifact listing entry.
 * The list API may return paths prefixed with the bucket name
 * (e.g. "store_dev_.../agents/{runId}/files/foo.txt"), so we search
 * for the "agents/{runId}/" segment anywhere in the string rather
 * than assuming it starts at index 0.
 */
function stripToRelativePath(fullPath: string, runId: string): string {
    const prefix = `agents/${runId}/`;
    const idx = fullPath.indexOf(prefix);
    if (idx !== -1) return fullPath.slice(idx + prefix.length);
    return fullPath.split('/').pop() ?? fullPath;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseArtifactsResult {
    /** Tree of the currently visible files (respects `showSystem`). */
    tree: ArtifactTreeNode[];
    /** Currently visible files (respects `showSystem`). */
    flatFiles: string[];
    /** Total number of artifacts in the run, including system files. */
    totalCount: number;
    /** Number of system files currently hidden (0 when `showSystem` is true). */
    systemHiddenCount: number;
    isLoading: boolean;
    error: string | null;
    refresh: () => void;
}

export function useArtifacts(
    client: VertesiaClient,
    runId: string | undefined,
    refreshKey = 0,
    showSystem = false,
): UseArtifactsResult {
    const [allFiles, setAllFiles] = useState<string[]>([]);
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

            const relatives = paths.map((p) => stripToRelativePath(p, runId)).filter((p) => !!p);

            setAllFiles(relatives);
        } catch (err) {
            if (fetchId !== fetchIdRef.current) return;
            setError(err instanceof Error ? err.message : 'Failed to list artifacts');
            setAllFiles([]);
        } finally {
            if (fetchId === fetchIdRef.current) {
                setIsLoading(false);
            }
        }
    }, [client, runId]);

    useEffect(() => {
        void refreshKey;
        void manualRefreshKey;
        void fetchArtifacts();
    }, [fetchArtifacts, refreshKey, manualRefreshKey]);

    const flatFiles = useMemo(
        () => (showSystem ? allFiles : allFiles.filter((p) => !isSystemArtifact(p))),
        [allFiles, showSystem],
    );
    const tree = useMemo(() => buildTree(flatFiles), [flatFiles]);
    const systemHiddenCount = allFiles.length - flatFiles.length;

    const refresh = useCallback(() => {
        setManualRefreshKey((k) => k + 1);
    }, []);

    return { tree, flatFiles, totalCount: allFiles.length, systemHiddenCount, isLoading, error, refresh };
}
