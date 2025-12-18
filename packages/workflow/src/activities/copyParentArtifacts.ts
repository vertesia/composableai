import { log, activityInfo } from "@temporalio/activity";
import { NodeStreamSource } from "@vertesia/client/node";
import { DSLActivityExecutionPayload, DSLActivitySpec } from "@vertesia/common";
import { Readable } from "stream";
import { setupActivity } from "../dsl/setup/ActivityContext.js";

/**
 * Directories in the agent workspace that can be copied from parent to child.
 * These match the workspace structure used by execute_shell:
 * - scripts/ -> /home/daytona/scripts/
 * - files/   -> /home/daytona/files/
 * - skills/  -> /home/daytona/skills/
 * - docs/    -> /home/daytona/documents/
 * - out/     -> /home/daytona/out/
 */
export const WORKSPACE_DIRECTORIES = ['scripts', 'files', 'skills', 'docs', 'out'] as const;
export type WorkspaceDirectory = typeof WORKSPACE_DIRECTORIES[number];

export interface CopyParentArtifactsParams {
    /**
     * The parent workflow run ID to copy artifacts from.
     * If not provided, uses the parent.run_id from the payload.
     */
    parent_run_id?: string;

    /**
     * Which workspace directories to copy. Defaults to all: scripts, files, skills, docs, out.
     * You can limit to specific directories, e.g., ['scripts', 'files'] to only copy scripts and data.
     */
    directories?: WorkspaceDirectory[];

    /**
     * Optional list of file patterns to exclude (simple glob with * wildcard).
     * By default, conversation.json and tools.json are excluded.
     */
    exclude_patterns?: string[];
}

export interface CopyParentArtifacts extends DSLActivitySpec<CopyParentArtifactsParams> {
    name: 'copyParentArtifacts';
    projection?: never;
}

/**
 * Copy workspace artifacts from a parent workflow's agent space to the current workflow's agent space.
 *
 * This enables child workflows (spawned via parallel workstreams) to inherit the parent's:
 * - scripts (Python/shell scripts)
 * - files (data files like CSV, JSON)
 * - skills (skill script bundles)
 * - docs (document snapshots)
 * - out (output files)
 *
 * After copying, these files will be available when execute_shell syncs to the sandbox.
 *
 * @param payload - Activity execution payload containing parent_run_id and optional filters
 * @returns Object with copied files count and list of copied file paths
 */
export async function copyParentArtifacts(
    payload: DSLActivityExecutionPayload<CopyParentArtifactsParams>
): Promise<{ copied: number; files: string[]; skipped: string[] }> {
    const { client, params } = await setupActivity<CopyParentArtifactsParams>(payload);
    const { runId: childRunId } = activityInfo().workflowExecution;

    // Get parent run ID from params or from the payload's parent reference
    const parentRunId = params.parent_run_id || payload.parent?.run_id;

    if (!parentRunId) {
        log.info("No parent run ID provided, skipping artifact copy");
        return { copied: 0, files: [], skipped: [] };
    }

    if (parentRunId === childRunId) {
        log.warn("Parent and child run IDs are the same, skipping artifact copy");
        return { copied: 0, files: [], skipped: [] };
    }

    log.info(`Copying workspace artifacts from parent ${parentRunId} to child ${childRunId}`);

    // Directories to copy (default: all workspace directories)
    const directories = params.directories || [...WORKSPACE_DIRECTORIES];

    // Default exclusions - don't copy conversation/tools as child has its own
    const excludePatterns = params.exclude_patterns || ['conversation.json', 'tools.json'];

    try {
        // List all files in parent's agent space
        const parentFiles = await client.files.listArtifacts(parentRunId);

        if (parentFiles.length === 0) {
            log.info("No artifacts found in parent agent space");
            return { copied: 0, files: [], skipped: [] };
        }

        log.info(`Found ${parentFiles.length} files in parent agent space`);

        const copiedFiles: string[] = [];
        const skippedFiles: string[] = [];

        for (const fullPath of parentFiles) {
            // Extract relative path from full storage path
            const relativePath = extractRelativePath(fullPath, parentRunId);

            if (!relativePath) {
                log.debug(`Could not extract relative path from: ${fullPath}`);
                skippedFiles.push(fullPath);
                continue;
            }

            // Check if file is in one of the directories we want to copy
            const directory = getDirectory(relativePath);
            if (!directory || !directories.includes(directory)) {
                log.debug(`Skipping file outside target directories: ${relativePath}`);
                skippedFiles.push(relativePath);
                continue;
            }

            // Check exclude patterns
            const fileName = relativePath.split('/').pop() || relativePath;
            if (matchesAnyPattern(fileName, excludePatterns) || matchesAnyPattern(relativePath, excludePatterns)) {
                log.debug(`Skipping excluded file: ${relativePath}`);
                skippedFiles.push(relativePath);
                continue;
            }

            try {
                await copyArtifact(client, parentRunId, childRunId, relativePath);
                copiedFiles.push(relativePath);
                log.debug(`Copied: ${relativePath}`);
            } catch (err: any) {
                log.error(`Failed to copy artifact ${relativePath}`, { error: err.message });
                skippedFiles.push(relativePath);
            }
        }

        log.info(`Copied ${copiedFiles.length} artifacts from parent to child`, {
            copied: copiedFiles.length,
            skipped: skippedFiles.length,
            directories
        });

        return { copied: copiedFiles.length, files: copiedFiles, skipped: skippedFiles };

    } catch (err: any) {
        log.error(`Failed to copy parent artifacts`, { error: err.message, parentRunId, childRunId });
        throw new Error(`Failed to copy parent artifacts: ${err.message}`);
    }
}

/**
 * Extract relative path from full artifact storage path.
 * Storage paths can be: "store_xxx/agents/{runId}/..." or "agents/{runId}/..."
 */
function extractRelativePath(fullPath: string, runId: string): string | null {
    // Look for the pattern: agents/{runId}/
    const marker = `/agents/${runId}/`;
    const idx = fullPath.lastIndexOf(marker);
    if (idx >= 0) {
        return fullPath.slice(idx + marker.length);
    }

    // Also try without leading slash
    const legacyPrefix = `agents/${runId}/`;
    if (fullPath.startsWith(legacyPrefix)) {
        return fullPath.slice(legacyPrefix.length);
    }

    // If path contains the runId, try to extract after it
    const runIdIdx = fullPath.indexOf(runId);
    if (runIdIdx >= 0) {
        const afterRunId = fullPath.slice(runIdIdx + runId.length);
        if (afterRunId.startsWith('/')) {
            return afterRunId.slice(1);
        }
    }

    return null;
}

/**
 * Get the workspace directory from a relative path
 */
function getDirectory(relativePath: string): WorkspaceDirectory | null {
    for (const dir of WORKSPACE_DIRECTORIES) {
        if (relativePath.startsWith(`${dir}/`)) {
            return dir;
        }
    }
    return null;
}

/**
 * Check if filename matches any of the patterns (simple glob: * matches anything)
 */
function matchesAnyPattern(value: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
        if (pattern === value) {
            return true;
        }
        // Simple wildcard matching
        if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
            if (regex.test(value)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Copy a single artifact from parent to child agent space
 */
async function copyArtifact(
    client: any,
    parentRunId: string,
    childRunId: string,
    relativePath: string
): Promise<void> {
    // Download from parent's agent space
    const stream = await client.files.downloadArtifact(parentRunId, relativePath);

    // Convert web stream to node stream for upload
    const nodeStream = Readable.fromWeb(stream as any);

    // Determine mime type from extension
    const mimeType = getMimeType(relativePath);
    const fileName = relativePath.split('/').pop() || relativePath;

    // Upload to child's agent space at the same relative path
    const source = new NodeStreamSource(
        nodeStream,
        fileName,
        mimeType
    );

    await client.files.uploadArtifact(childRunId, relativePath, source);
}

/**
 * Get mime type from file extension
 */
function getMimeType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
        'json': 'application/json',
        'txt': 'text/plain',
        'md': 'text/markdown',
        'html': 'text/html',
        'csv': 'text/csv',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'pdf': 'application/pdf',
        'xml': 'application/xml',
        'zip': 'application/zip',
        'js': 'application/javascript',
        'ts': 'application/typescript',
        'py': 'text/x-python',
        'sh': 'text/x-shellscript',
        'bash': 'text/x-shellscript',
        'yaml': 'text/yaml',
        'yml': 'text/yaml',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
}
