import { log, activityInfo } from "@temporalio/activity";
import { NodeStreamSource } from "@vertesia/client/node";
import { DSLActivityExecutionPayload, DSLActivitySpec } from "@vertesia/common";
import { Readable } from "stream";
import { setupActivity } from "../dsl/setup/ActivityContext.js";

/**
 * Directories in the agent workspace to copy from parent to child.
 */
const WORKSPACE_DIRECTORIES = ['scripts', 'files', 'skills', 'docs', 'out'];

/**
 * Files that should never be copied (child has its own).
 */
const EXCLUDED_FILES = ['conversation.json', 'tools.json'];

export interface CopyParentArtifactsParams {
    parent_run_id: string;
}

export interface CopyParentArtifacts extends DSLActivitySpec<CopyParentArtifactsParams> {
    name: 'copyParentArtifacts';
    projection?: never;
}

/**
 * Copy workspace artifacts from parent workflow's agent space to current workflow's agent space.
 *
 * Copies: scripts/, files/, skills/, docs/, out/
 * Excludes: conversation.json, tools.json
 */
export async function copyParentArtifacts(
    payload: DSLActivityExecutionPayload<CopyParentArtifactsParams>
): Promise<{ copied: number; files: string[] }> {
    const { client, params } = await setupActivity<CopyParentArtifactsParams>(payload);
    const childRunId = activityInfo().workflowExecution.runId;
    const parentRunId = params.parent_run_id;

    log.info(`Copying artifacts from parent ${parentRunId} to child ${childRunId}`);

    // List all files in parent's agent space
    const parentFiles = await client.files.listArtifacts(parentRunId);

    if (parentFiles.length === 0) {
        log.info("No artifacts in parent agent space");
        return { copied: 0, files: [] };
    }

    const copiedFiles: string[] = [];

    for (const fullPath of parentFiles) {
        const relativePath = extractRelativePath(fullPath, parentRunId);
        if (!relativePath) continue;

        // Only copy workspace directories
        const dir = relativePath.split('/')[0];
        if (!WORKSPACE_DIRECTORIES.includes(dir)) continue;

        // Skip excluded files
        const fileName = relativePath.split('/').pop() || '';
        if (EXCLUDED_FILES.includes(fileName)) continue;

        try {
            await copyArtifact(client, parentRunId, childRunId, relativePath);
            copiedFiles.push(relativePath);
        } catch (err: any) {
            log.warn(`Failed to copy ${relativePath}: ${err.message}`);
        }
    }

    log.info(`Copied ${copiedFiles.length} artifacts from parent`);
    return { copied: copiedFiles.length, files: copiedFiles };
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
