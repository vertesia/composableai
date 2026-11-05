import { ApiTopic, type ClientBase, type IRequestRetryPolicy, RequestError } from '@vertesia/api-fetch-client';
import type {
    AbortUploadSessionPayload,
    AbortUploadSessionResponse,
    BucketCreateAccessStatusResponse,
    BucketReadAccessStatusResponse,
    BulkUploadUrlsPayload,
    BulkUploadUrlsResponse,
    CompleteUploadSessionPayload,
    CompleteUploadSessionResponse,
    CreateUploadSessionPayload,
    DeleteFileResult,
    EnsureBucketCreateAccessPayload,
    EnsureBucketCreateAccessResponse,
    EnsureBucketReadAccessPayload,
    EnsureBucketReadAccessResponse,
    FileBucketResponse,
    FileListResponse,
    FileMetadataResponse,
    FileMetadataUpdateResult,
    GetFileUrlPayload,
    GetFileUrlResponse,
    GetUploadPartUrlsPayload,
    GetUploadUrlPayload,
    SetFileMetadataPayload,
    UploadPartUrlsResponse,
    UploadSession,
} from '@vertesia/common';
import { StreamSource } from '../StreamSource.js';
import { partsAsUploadBody, planUpload, UploadSessionUnavailableError, uploadInParts } from './chunked-upload.js';
import { fetchSignedUrl } from './signed-url.js';
import { type UploadBody, uploadHeaders } from './upload-body.js';
import { getUploadMimeTypeHint, resolveUploadMimeType } from './uploadMimeType.js';

export const MEMORIES_PREFIX = 'memories';
export const ARTIFACTS_PREFIX = 'agents';

const FILE_SIGNING_RETRY_POLICY: IRequestRetryPolicy = {
    attempts: 3,
    methods: ['POST'],
    statuses: [502, 503, 504],
};

function fileLocationForError(location: string): string {
    try {
        const url = new URL(location);
        return `${url.protocol}//${url.host}${url.pathname}`;
    } catch {
        return location.split(/[?#]/, 1)[0] || 'unknown file';
    }
}

function sanitizedErrorCause(error: unknown): Error | undefined {
    if (!(error instanceof Error)) {
        return undefined;
    }
    const message = error.message.replace(/https?:\/\/[^\s)\]}>"']+/g, (url) => fileLocationForError(url));
    const cause = new Error(message);
    cause.name = error.name;
    return cause;
}

function fileDownloadFailureReason(status?: number, statusText?: string): string {
    if (status === 404) return 'not found';
    if (status === 403) return 'forbidden';
    if (status) return `failed with status ${status}${statusText ? ` ${statusText}` : ''}`;
    return 'failed';
}

export class FileDownloadError extends Error {
    readonly status?: number;

    constructor(location: string, status?: number, statusText?: string, cause?: unknown) {
        const safeLocation = fileLocationForError(location);
        const reason = fileDownloadFailureReason(status, statusText);
        super(`File download ${reason}: ${safeLocation}`, { cause: sanitizedErrorCause(cause) });
        this.name = 'FileDownloadError';
        this.status = status;
    }
}

export function getMemoryFilePath(name: string) {
    const nameWithExt = name.endsWith('.tar.gz') ? name : `${name}.tar.gz`;
    return `${MEMORIES_PREFIX}/${nameWithExt}`;
}

/**
 * Build the storage path for an agent artifact
 * @param runId - The workflow run ID
 * @param name - The artifact filename
 */
export function getAgentArtifactPath(runId: string, name: string): string {
    return `${ARTIFACTS_PREFIX}/${runId}/${name}`;
}

export class FilesApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/files');
    }

    async deleteFile(path: string, prefix?: boolean): Promise<DeleteFileResult> {
        return this.del(`/${path}`, { query: { prefix } });
    }

    /**
     * get the metadata of a blob given its URI. Supported URI are:
     * starting with s3:// and gs://.
     * For s3 blobs use #region to specify the region. Ex: s3://bucket/key#us-west-2
     * @param uri
     * @returns
     */
    getMetadata(uri: string): Promise<FileMetadataResponse> {
        return this.get('/metadata', {
            query: {
                file: uri,
            },
        });
    }

    /**
     * Set custom metadata on a file
     * @param file - The file path or URI
     * @param metadata - Custom metadata key-value pairs
     * @returns Success status
     */
    setFileMetadata(file: string, metadata: Record<string, string>): Promise<FileMetadataUpdateResult> {
        const payload: SetFileMetadataPayload = { file, metadata };
        return this.put('/metadata', { payload });
    }

    /**
     * Get or create a bucket for the project. If the bucket already exists, it does nothing.
     * The bucket URI is returned.
     * @returns
     */
    getOrCreateBucket(): Promise<FileBucketResponse> {
        return this.post('/bucket');
    }

    ensureBucketReadAccess(principal: string): Promise<EnsureBucketReadAccessResponse> {
        const payload: EnsureBucketReadAccessPayload = { principal };
        return this.post('/bucket/read-access', { payload });
    }

    getBucketReadAccessStatus(principal: string): Promise<BucketReadAccessStatusResponse> {
        return this.get('/bucket/read-access', { query: { principal } });
    }

    ensureBucketCreateAccess(principal: string): Promise<EnsureBucketCreateAccessResponse> {
        const payload: EnsureBucketCreateAccessPayload = { principal };
        return this.post('/bucket/create-access', { payload });
    }

    getBucketCreateAccessStatus(principal: string): Promise<BucketCreateAccessStatusResponse> {
        return this.get('/bucket/create-access', { query: { principal } });
    }

    list(prefix: string): Promise<FileListResponse> {
        return this.get('/list', { query: { prefix } });
    }

    getUploadUrl(payload: GetUploadUrlPayload): Promise<GetFileUrlResponse> {
        return this.post('/upload-url', {
            payload,
            retryPolicy: FILE_SIGNING_RETRY_POLICY,
        });
    }

    /**
     * Start an upload in parts, for content too large for one signed PUT. The upload methods of this API use it
     * for stream sources longer than one part; call it directly only to drive the store's protocol yourself.
     */
    createUploadSession(payload: CreateUploadSessionPayload): Promise<UploadSession> {
        return this.post('/upload-sessions', { payload, retryPolicy: FILE_SIGNING_RETRY_POLICY });
    }

    /** Signed URLs for parts of an `s3_multipart` upload session. */
    getUploadPartUrls(payload: GetUploadPartUrlsPayload): Promise<UploadPartUrlsResponse> {
        return this.post('/upload-sessions/parts', { payload, retryPolicy: FILE_SIGNING_RETRY_POLICY });
    }

    /** Assemble the uploaded parts of an `s3_multipart` upload session into the file. */
    completeUploadSession(payload: CompleteUploadSessionPayload): Promise<CompleteUploadSessionResponse> {
        return this.post('/upload-sessions/complete', { payload });
    }

    /** Discard an unfinished `s3_multipart` upload session and its parts. */
    abortUploadSession(payload: AbortUploadSessionPayload): Promise<AbortUploadSessionResponse> {
        return this.post('/upload-sessions/abort', { payload, retryPolicy: FILE_SIGNING_RETRY_POLICY });
    }

    // Strictly typed: provide either simple args or a full payload via a separate method
    getDownloadUrl(file: string, name?: string, disposition?: 'inline' | 'attachment'): Promise<GetFileUrlResponse> {
        const payload: GetFileUrlPayload = { file, name, disposition };
        return this.post('/download-url', { payload });
    }

    getDownloadUrlWithOptions(payload: GetFileUrlPayload): Promise<GetFileUrlResponse> {
        return this.post('/download-url', { payload });
    }

    /**
     * Get presigned upload URLs for multiple files in a single request.
     * Each file gets its own presigned URL for direct upload to cloud storage.
     * @param payload - Array of file descriptors (name, optional mime_type, optional id)
     * @returns Array of upload URL responses
     */
    bulkGetUploadUrls(payload: BulkUploadUrlsPayload): Promise<BulkUploadUrlsResponse> {
        return this.post('/bulk-upload-urls', { payload });
    }

    /**
     * Upload multiple files in parallel. Gets presigned URLs in bulk, then PUTs all files concurrently.
     * @param sources - Array of file sources to upload
     * @param concurrency - Maximum number of concurrent uploads (default: 10)
     * @returns Array of upload results with source URI, name, type, and etag
     */
    async bulkUpload(
        sources: (StreamSource | File)[],
        concurrency = 10,
    ): Promise<{ source: string; name: string; type?: string; etag?: string }[]> {
        const fileDescriptors = sources.map((s) => ({
            name: s.name,
            mime_type: getUploadMimeTypeHint(s.type),
            id: s instanceof StreamSource ? s.id : undefined,
        }));

        const { files } = await this.bulkGetUploadUrls({ files: fileDescriptors });

        // Upload with concurrency limit using chunked Promise.all
        const results: { source: string; name: string; type?: string; etag?: string }[] = new Array(sources.length);

        for (let i = 0; i < sources.length; i += concurrency) {
            const batch = sources.slice(i, i + concurrency);
            await Promise.all(
                batch.map(async (source, j) => {
                    const idx = i + j;
                    const { id, mime_type, etag } = await this.uploadContent(
                        source,
                        fileDescriptors[idx],
                        async () => files[idx],
                    );
                    results[idx] = { source: id, name: source.name, type: mime_type, etag };
                }),
            );
        }

        return results;
    }

    /**
     * Upload content to a file and return the file id.
     * @param source
     * @returns the uploaded file id
     */
    async uploadFile(source: StreamSource | File): Promise<string> {
        return (await this.uploadFileWithPath(source)).id;
    }

    /**
     * Upload content to a file and return both the file id and its storage path
     * (e.g. "bucket-name/path/to/file"). Prefer this over {@link uploadFile} when the
     * caller needs an importable reference (the path can be turned into a "gs://…" URL),
     * not just the opaque id.
     * @param source
     * @returns the uploaded file id and storage path
     */
    async uploadFileWithPath(source: StreamSource | File): Promise<{ id: string; path: string }> {
        return this.uploadSource(source, source instanceof StreamSource ? source.id : undefined, source.name);
    }

    /** Upload a source under a file id and name that may differ from its own. */
    private async uploadSource(
        source: StreamSource | File,
        fileId: string | undefined,
        name: string,
    ): Promise<{ id: string; path: string }> {
        const { id, path } = await this.uploadContent(
            source,
            { id: fileId, name, mime_type: getUploadMimeTypeHint(source.type) },
            undefined,
            'application/gzip',
        );
        return { id, path };
    }

    /**
     * Upload a source to the file `request` names: in one signed PUT, or, for a stream source longer than one part
     * in Node.js, in parts through an upload session (see `chunked-upload.ts`).
     *
     * @param signUpload the signed PUT URL to use, when the caller already has one or signs it another way
     * @param fallbackMimeType the content type when neither the source nor the server names one
     * @internal used by the upload methods of this API and of `ObjectsApi`
     */
    async uploadContent(
        source: StreamSource | File,
        request: CreateUploadSessionPayload,
        signUpload: () => Promise<GetFileUrlResponse> = () => this.getUploadUrl(request),
        fallbackMimeType?: string,
    ): Promise<{ id: string; path: string; mime_type?: string; etag?: string }> {
        const plan = await planUpload(source);
        let upload: UploadBody;
        if (plan.kind === 'parts') {
            const session = await this.createUploadSession(request).catch((err: unknown) => {
                // A server without upload sessions, or whose storage has none.
                if (err instanceof RequestError && (err.status === 404 || err.status === 501)) return undefined;
                throw err;
            });
            if (!session) {
                console.warn(`Upload sessions are not available; uploading ${request.name} in a single request`);
                upload = partsAsUploadBody(plan.parts);
            } else {
                try {
                    const etag = await uploadInParts(this, session, plan.parts);
                    const mime_type = resolveUploadMimeType(source.type, session.mime_type) || fallbackMimeType;
                    return { id: session.id, path: session.path, mime_type, etag };
                } catch (err: unknown) {
                    if (!(err instanceof UploadSessionUnavailableError)) {
                        console.error('Failed to upload file', { err: sanitizedErrorCause(err), id: session.id });
                        throw err;
                    }
                    console.warn(`${err.message}; uploading ${session.path} in a single request instead`);
                    upload = partsAsUploadBody(plan.parts);
                }
            }
        } else {
            upload = plan.upload;
        }

        const { url, id, path, mime_type } = await signUpload();
        const sourceMimeType = resolveUploadMimeType(source.type, mime_type) || fallbackMimeType;
        const res = await fetchSignedUrl(url, {
            method: 'PUT',
            body: upload.body,
            headers: uploadHeaders(upload, sourceMimeType),
        }).catch((err) => {
            console.error('Failed to upload file', { err, location: fileLocationForError(url), id, path });
            throw err;
        });
        if (!res.ok) {
            console.error('Failed to upload file', {
                status: res.status,
                statusText: res.statusText,
                location: fileLocationForError(url),
                id,
                path,
            });
            throw new Error(`Failed to upload file ${source.name}: ${res.statusText}`);
        }

        //Etag need to be unquoted
        //When a server returns an ETag header, it includes the quotes around the actual hash value.
        //This is part of the HTTP specification (RFC 7232), which states that ETags should be
        //enclosed in double quotes.
        const etag = res.headers.get('etag')?.replace(/^"(.*)"$/, '$1');
        return { id, path, mime_type: sourceMimeType, etag };
    }

    /**
     *
     * @param location can be a relative path in the project, a reference to a cloud storage, or a accessible HTTPS URL (typically signed URL)
     * @returns ReadableStream
     */
    async downloadFile(location: string): Promise<ReadableStream<Uint8Array<ArrayBuffer>>> {
        //if start with HTTPS, no download url needed - assume it's signed already
        const needSign = !location.startsWith('https:');
        const { url } = needSign ? await this.getDownloadUrl(location) : { url: location };

        let res: Response;
        try {
            res = await fetchSignedUrl(url, { method: 'GET' });
        } catch (error: unknown) {
            throw new FileDownloadError(location, undefined, undefined, error);
        }

        if (!res.ok) {
            throw new FileDownloadError(location, res.status, res.statusText);
        }

        if (!res.body) {
            throw new FileDownloadError(location);
        }

        return res.body;
    }

    /**
     * Copy a file to a new destination within the same bucket.
     * @param source - Source file path (relative to project bucket)
     * @param dest - Destination file path (relative to project bucket)
     * @returns The destination file URI
     */
    async copyFile(source: string, dest: string): Promise<string> {
        const response = (await this.post('/copy', {
            payload: { source, dest },
        })) as { success: boolean; source: string; dest: string };
        return response.dest;
    }

    async uploadMemoryPack(source: StreamSource | File): Promise<string> {
        const fileId = getMemoryFilePath(source.name);
        const nameWithExt = source.name.endsWith('.tar.gz') ? source.name : `${source.name}.tar.gz`;
        return (await this.uploadSource(source, fileId, nameWithExt)).id;
    }

    async downloadMemoryPack(name: string, gunzip: boolean = false): Promise<ReadableStream<Uint8Array>> {
        let stream = await this.downloadFile(getMemoryFilePath(name));
        if (gunzip) {
            const ds = new DecompressionStream('gzip');
            stream = stream.pipeThrough(ds);
        }
        return stream;
    }

    // ==================== Agent Artifact Methods ====================

    /**
     * List files by prefix
     * @param prefix - Path prefix to filter files
     * @returns Array of file paths matching the prefix
     */
    listByPrefix(prefix: string): Promise<{ files: string[] }> {
        return this.get('/list', { query: { prefix } });
    }

    /**
     * Upload an artifact for an agent run
     * @param runId - The workflow run ID
     * @param name - Artifact name (e.g., "output.json")
     * @param source - File content source
     * @returns The full path of the uploaded artifact
     */
    async uploadArtifact(runId: string, name: string, source: StreamSource | File): Promise<string> {
        const artifactPath = getAgentArtifactPath(runId, name);
        return (await this.uploadSource(source, artifactPath, name)).id;
    }

    /**
     * Download an artifact from an agent run
     * @param runId - The workflow run ID
     * @param name - Artifact name
     * @returns ReadableStream of the artifact content
     */
    async downloadArtifact(runId: string, name: string): Promise<ReadableStream<Uint8Array>> {
        const artifactPath = getAgentArtifactPath(runId, name);
        return this.downloadFile(artifactPath);
    }

    /**
     * Get download URL for an artifact
     * @param runId - The workflow run ID
     * @param name - Artifact name
     * @param disposition - Content disposition (inline or attachment)
     * @returns Signed URL response
     */
    getArtifactDownloadUrl(
        runId: string,
        name: string,
        disposition?: 'inline' | 'attachment',
    ): Promise<GetFileUrlResponse> {
        const artifactPath = getAgentArtifactPath(runId, name);
        return this.getDownloadUrl(artifactPath, name, disposition);
    }

    /**
     * List artifacts for an agent run
     * @param runId - The workflow run ID
     * @returns Array of artifact file paths
     */
    async listArtifacts(runId: string): Promise<string[]> {
        const prefix = `${ARTIFACTS_PREFIX}/${runId}/`;
        const result = await this.listByPrefix(prefix);
        return result.files;
    }
}
