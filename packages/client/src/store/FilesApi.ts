import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import {
    GetFileUrlPayload,
    GetFileUrlResponse,
    GetUploadUrlPayload,
    SetFileMetadataPayload,
} from "@vertesia/common";
import { StreamSource } from "../StreamSource.js";

export const MEMORIES_PREFIX = "memories";
export const ARTIFACTS_PREFIX = "agents";

export function getMemoryFilePath(name: string) {
    const nameWithExt = name.endsWith(".tar.gz") ? name : name + ".tar.gz";
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
        super(parent, "/api/v1/files");
    }

    async deleteFile(path: string, prefix?: boolean): Promise<void | number> {
        const res = await this.delete(`/${path}`, { query: { prefix } });
        return res.count;
    }

    /**
     * get the metadata of a blob given its URI. Supported URI are:
     * starting with s3:// and gs://.
     * For s3 blobs use #region to specify the region. Ex: s3://bucket/key#us-west-2
     * @param uri
     * @returns
     */
    getMetadata(uri: string): Promise<{
        name: string;
        size: number;
        contentType: string;
        contentDisposition?: string;
        etag?: string;
        customMetadata?: Record<string, string>;
    }> {
        return this.get("/metadata", {
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
    setFileMetadata(file: string, metadata: Record<string, string>): Promise<{ success: boolean; file: string }> {
        const payload: SetFileMetadataPayload = { file, metadata };
        return this.put("/metadata", { payload });
    }

    /**
     * Get or create a bucket for the project. If the bucket already exists, it does nothing.
     * The bucket URI is returned.
     * @returns
     */
    getOrCreateBucket(): Promise<{ bucket: string }> {
        return this.post("/bucket");
    }

    getUploadUrl(payload: GetUploadUrlPayload): Promise<GetFileUrlResponse> {
        return this.post("/upload-url", {
            payload,
        });
    }

    // Strictly typed: provide either simple args or a full payload via a separate method
    getDownloadUrl(file: string, name?: string, disposition?: "inline" | "attachment"): Promise<GetFileUrlResponse> {
        const payload: GetFileUrlPayload = { file, name, disposition };
        return this.post("/download-url", { payload });
    }

    getDownloadUrlWithOptions(payload: GetFileUrlPayload): Promise<GetFileUrlResponse> {
        return this.post("/download-url", { payload });
    }

    /**
     * Upload content to a file and return the full path (including bucket name) of the uploaded file
     * @param source
     * @returns
     */
    async uploadFile(source: StreamSource | File): Promise<string> {
        const isStream = source instanceof StreamSource;
        const { url, id, path } = await this.getUploadUrl(source);

        await fetch(url, {
            method: "PUT",
            body: isStream ? source.stream : source,
            //@ts-ignore: duplex is not in the types. See https://github.com/node-fetch/node-fetch/issues/1769
            duplex: isStream ? "half" : undefined,
            headers: {
                "Content-Type": source.type || "application/gzip",
            },
        })
            .then((res: Response) => {
                if (res.ok) {
                    return res;
                } else {
                    console.log(res);
                    throw new Error(`Failed to upload file: ${res.statusText}`);
                }
            })
            .catch((err) => {
                console.error("Failed to upload file", { err, url, id, path });
                throw err;
            });

        return id;
    }

    /**
     *
     * @param location can be a relative path in the project, a reference to a cloud storage, or a accessible HTTPS URL (typically signed URL)
     * @returns ReadableStream
     */
    async downloadFile(location: string): Promise<ReadableStream<Uint8Array<ArrayBuffer>>> {
        //if start with HTTPS, no download url needed - assume it's signed already
        const needSign = !location.startsWith("https:");
        const { url } = needSign
            ? await this.getDownloadUrl(location)
            : { url: location };

        const res = await fetch(url, {
            method: "GET",
        })
            .then((res: Response) => {
                if (res.ok) {
                    return res;
                } else if (res.status === 404) {
                    throw new Error(`File at ${url} not found`); //TODO: type fetch error better with a fetch error class
                } else if (res.status === 403) {
                    throw new Error(`File at ${url} is forbidden`);
                } else {
                    console.log(res);
                    throw new Error(
                        `Failed to download file ${location}: ${res.statusText}`,
                    );
                }
            })
            .catch((err) => {
                console.error(`Failed to download file ${location}.`, err);
                throw err;
            });

        if (!res.body) {
            throw new Error(
                `No body in response while downloading file ${location}`,
            );
        }

        return res.body;
    }

    async uploadMemoryPack(source: StreamSource | File): Promise<string> {
        const fileId = getMemoryFilePath(source.name);
        const nameWithExt = source.name.endsWith(".tar.gz")
            ? source.name
            : source.name + ".tar.gz";
        if (source instanceof File) {
            let file = source as File;
            return this.uploadFile(
                new StreamSource(file.stream(), nameWithExt, file.type, fileId),
            );
        } else {
            return this.uploadFile(
                new StreamSource(
                    source.stream,
                    nameWithExt,
                    source.type,
                    fileId,
                ),
            );
        }
    }

    async downloadMemoryPack(
        name: string,
        gunzip: boolean = false,
    ): Promise<ReadableStream<Uint8Array>> {
        let stream = await this.downloadFile(getMemoryFilePath(name));
        if (gunzip) {
            const ds = new DecompressionStream("gzip");
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
        return this.get("/list", { query: { prefix } });
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
        if (source instanceof File) {
            const file = source as File;
            return this.uploadFile(
                new StreamSource(file.stream(), name, file.type, artifactPath)
            );
        } else {
            return this.uploadFile(
                new StreamSource(source.stream, name, source.type, artifactPath)
            );
        }
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
        disposition?: "inline" | "attachment"
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
