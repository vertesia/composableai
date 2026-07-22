export interface DocumentArtifactCopyApi {
    copyFile(source: string, dest: string): Promise<unknown>;
}

// Run-local artifact links — excludes paths already pointing at durable storage
// (agents/ run prefixes, documents/ repository copies). Mirrors the regex used by
// the create_document tool so both publication paths persist the same links.
const RUN_LOCAL_ARTIFACT_REF_REGEX = /artifact:(?!agents\/)(?!documents\/)([^\s)\]"]+)/g;

export function collectRunLocalArtifactRefs(content: string): string[] {
    const refs = new Set<string>();
    for (const match of content.matchAll(RUN_LOCAL_ARTIFACT_REF_REGEX)) {
        refs.add(match[1].replace(/^\/+/, ''));
    }
    return [...refs];
}

export interface PersistRunLocalArtifactRefsResult {
    content: string;
    /** Links rewritten to a durable documents/ copy. */
    persisted: Array<{ from: string; to: string }>;
    /** Links whose copy failed; rewritten to the run-scoped agents/ path instead. */
    failed: string[];
}

/**
 * Copy run-local `artifact:` references into durable `documents/{batchId}/` storage
 * and rewrite the links — the Save-to-document counterpart of the persistence pass
 * `create_document` applies when a document is first created from agent content.
 *
 * Run artifact storage is scoped to the agent run and does not outlive it, so a
 * published document must never depend on it. When a copy fails the link is pinned
 * to the explicit run-scoped `agents/` path rather than left run-relative, so it
 * can never silently resolve against a different run's artifact space.
 */
export async function persistRunLocalArtifactRefs(
    files: DocumentArtifactCopyApi,
    content: string,
    agentRunId: string,
    batchId: string,
): Promise<PersistRunLocalArtifactRefsResult> {
    const refs = collectRunLocalArtifactRefs(content);
    if (refs.length === 0) {
        return { content, persisted: [], failed: [] };
    }

    const rewrites = new Map<string, string>();
    const persisted: Array<{ from: string; to: string }> = [];
    const failed: string[] = [];
    for (const relPath of refs) {
        const destPath = `documents/${batchId}/${relPath}`;
        try {
            await files.copyFile(`agents/${agentRunId}/${relPath}`, destPath);
            rewrites.set(relPath, destPath);
            persisted.push({ from: relPath, to: destPath });
        } catch (error: unknown) {
            console.warn('Failed to persist a referenced artifact; keeping a run-scoped link', {
                artifact_path: relPath,
                error: error instanceof Error ? error.message : String(error),
            });
            rewrites.set(relPath, `agents/${agentRunId}/${relPath}`);
            failed.push(relPath);
        }
    }

    const rewritten = content.replace(RUN_LOCAL_ARTIFACT_REF_REGEX, (match, relPath: string) => {
        const destPath = rewrites.get(relPath.replace(/^\/+/, ''));
        return destPath ? `artifact:${destPath}` : match;
    });

    return { content: rewritten, persisted, failed };
}
