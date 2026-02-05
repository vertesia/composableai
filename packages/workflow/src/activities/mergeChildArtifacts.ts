import { log } from "@temporalio/activity";
import { NodeStreamSource } from "@vertesia/client/node";
import { DSLActivityExecutionPayload, DSLActivitySpec } from "@vertesia/common";
import { Readable } from "stream";
import { setupActivity } from "../dsl/setup/ActivityContext.js";

/**
 * Directories to merge from child to parent.
 * Only out/ and files/ are merged to avoid overwriting parent's scripts/skills.
 */
const MERGE_DIRECTORIES = ['out', 'files'];

/**
 * Files that should never be merged.
 */
const EXCLUDED_FILES = ['conversation.json', 'tools.json'];

export interface MergeChildArtifactsParams {
    child_run_id: string;
    parent_run_id: string;
    directories?: string[];  // defaults to MERGE_DIRECTORIES
}

export interface MergeChildArtifacts extends DSLActivitySpec<MergeChildArtifactsParams> {
    name: 'mergeChildArtifacts';
    projection?: never;
}

/**
 * Merge artifacts from child workflow's agent space to parent workflow's agent space.
 *
 * Files are namespaced by child run ID to avoid conflicts:
 * - Child's `files/output.json` → Parent's `files/{childRunId}/output.json`
 * - Child's `out/report.pdf` → Parent's `out/{childRunId}/report.pdf`
 *
 * Returns the list of merged paths in the parent's space for the model to access.
 */
export async function mergeChildArtifacts(
    payload: DSLActivityExecutionPayload<MergeChildArtifactsParams>
): Promise<{ merged: number; files: string[] }> {
    const { client, params } = await setupActivity<MergeChildArtifactsParams>(payload);
    const childRunId = params.child_run_id;
    const parentRunId = params.parent_run_id;
    const directories = params.directories || MERGE_DIRECTORIES;

    log.info(`Merging artifacts from child ${childRunId} to parent ${parentRunId}`, { directories });

    // List all files in child's agent space
    const childFiles = await client.files.listArtifacts(childRunId);

    if (childFiles.length === 0) {
        log.info("No artifacts in child agent space");
        return { merged: 0, files: [] };
    }

    const mergedFiles: string[] = [];

    for (const fullPath of childFiles) {
        const relativePath = extractRelativePath(fullPath, childRunId);
        if (!relativePath) continue;

        // Only merge specified directories
        const dir = relativePath.split('/')[0];
        if (!directories.includes(dir)) continue;

        // Skip excluded files
        const fileName = relativePath.split('/').pop() || '';
        if (EXCLUDED_FILES.includes(fileName)) continue;

        try {
            // Create namespaced path: files/output.json -> files/{childRunId}/output.json
            const namespacedPath = createNamespacedPath(relativePath, childRunId);
            await copyArtifact(client, childRunId, parentRunId, relativePath, namespacedPath);
            mergedFiles.push(namespacedPath);
        } catch (err: any) {
            log.warn(`Failed to merge ${relativePath}: ${err.message}`);
        }
    }

    log.info(`Merged ${mergedFiles.length} artifacts from child to parent`, { files: mergedFiles });
    return { merged: mergedFiles.length, files: mergedFiles };
}

/**
 * Create a namespaced path by inserting the child run ID after the directory.
 * files/output.json -> files/{childRunId}/output.json
 * out/subdir/report.pdf -> out/{childRunId}/subdir/report.pdf
 */
function createNamespacedPath(relativePath: string, childRunId: string): string {
    const parts = relativePath.split('/');
    if (parts.length < 2) {
        // Single file at root (shouldn't happen, but handle it)
        return `${childRunId}/${relativePath}`;
    }
    // Insert childRunId after the first directory
    const dir = parts[0];
    const rest = parts.slice(1).join('/');
    return `${dir}/${childRunId}/${rest}`;
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
 * Copy a single artifact from child to parent agent space with a new path
 */
async function copyArtifact(
    client: any,
    childRunId: string,
    parentRunId: string,
    sourcePath: string,
    destPath: string
): Promise<void> {
    // Download from child's agent space
    const stream = await client.files.downloadArtifact(childRunId, sourcePath);

    // Convert web stream to node stream for upload
    const nodeStream = Readable.fromWeb(stream as any);

    // Determine mime type from extension
    const mimeType = getMimeType(sourcePath);
    const fileName = sourcePath.split('/').pop() || sourcePath;

    // Upload to parent's agent space at the namespaced path
    const source = new NodeStreamSource(
        nodeStream,
        fileName,
        mimeType
    );

    await client.files.uploadArtifact(parentRunId, destPath, source);
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
