import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import {
    canGenerateRendition,
    ComplexSearchPayload,
    ComputeObjectFacetPayload,
    ContentObject,
    ContentObjectApiHeaders,
    ContentObjectItem,
    ContentObjectProcessingPriority,
    ContentSource,
    CreateContentObjectPayload,
    Embedding,
    ExportPropertiesPayload,
    ExportPropertiesResponse,
    FindPayload,
    GetFileUrlPayload,
    GetFileUrlResponse,
    GetRenditionParams,
    GetRenditionResponse,
    getSupportedRenditionFormats,
    GetUploadUrlPayload,
    ListWorkflowRunsResponse,
    ObjectSearchPayload,
    ObjectSearchQuery,
    SupportedEmbeddingTypes,
    supportsVisualRendition
} from "@vertesia/common";

// Re-export rendition utilities for consumers
export { canGenerateRendition, getSupportedRenditionFormats, supportsVisualRendition };

import { StreamSource } from "../StreamSource.js";
import { AnalyzeDocApi } from "./AnalyzeDocApi.js";
import { ZenoClient } from "./client.js";

export interface ComputeFacetsResponse {
    type?: { _id: string; count: number }[];
    location?: { _id: string; count: number }[];
    status?: { _id: string; count: number }[];
    total?: number;
}

export interface SearchResponse {
    results: ContentObjectItem[];
    facets: ComputeFacetsResponse;
}

export class ObjectsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/objects");
    }

    analyze(objectId: string) {
        return new AnalyzeDocApi(this, objectId);
    }

    getUploadUrl(payload: GetUploadUrlPayload): Promise<GetFileUrlResponse> {
        return this.post("/upload-url", {
            payload,
        });
    }

    getDownloadUrl(fileUri: string, name?: string, disposition?: "inline" | "attachment"): Promise<{ url: string }> {
        return this.post("/download-url", {
            payload: { file: fileUri, name, disposition } satisfies GetFileUrlPayload,
        });
    }

    getDownloadUrlWithOptions(payload: GetFileUrlPayload): Promise<{ url: string }> {
        return this.post("/download-url", { payload });
    }

    getContentSource(objectId: string): Promise<ContentSource> {
        return this.get(`/${objectId}/content-source`);
    }

    /**
     * List objects with revision filtering options
     *
     * @param payload Search/filter parameters
     * @returns Matching content objects
     */
    list<T = any>(
        payload: ObjectSearchPayload = {},
    ): Promise<ContentObjectItem<T>[]> {
        const limit = payload.limit || 100;
        const offset = payload.offset || 0;
        const query = payload.query || ({} as ObjectSearchQuery);

        return this.get("/", {
            query: {
                limit,
                offset,
                ...query,
                all_revisions: payload.all_revisions,
                from_root: payload.from_root || undefined,
            },
        });
    }

    computeFacets(
        query: ComputeObjectFacetPayload,
    ): Promise<ComputeFacetsResponse> {
        return this.post("/facets", {
            payload: query,
        });
    }

    listFolders(path: string = "/") {
        path; //TODO
    }

    /** Find object based on query */
    find(payload: FindPayload): Promise<ContentObject[]> {
        return this.post("/find", {
            payload,
        });
    }

    /** Count number of objects matching this query */
    count(payload: FindPayload): Promise<{ count: number }> {
        return this.post("/count", {
            payload,
        });
    }

    /** Search object — different from find because allow full text search */
    search(payload: ComplexSearchPayload): Promise<SearchResponse> {
        return this.post("/search", {
            payload,
        });
    }

    retrieve(id: string, select?: string): Promise<ContentObject> {
        return this.get(`/${id}`, {
            query: {
                select,
            },
        });
    }

    getObjectText(id: string): Promise<{ text: string }> {
        return this.get(`/${id}/text`);
    }

    async upload(source: StreamSource | File) {
        const isStream = source instanceof StreamSource;
        // get a signed URL to upload the file a computed mimeType and the file object id.
        const { url, id, mime_type } = await this.getUploadUrl({
            id: isStream ? source.id : undefined,
            name: source.name,
            mime_type: source.type,
        });
        const sourceMimeType = source.type || mime_type;

        // upload the file content to the signed URL
        /*const res = await this.fetch(url, {
            method: 'PUT',
            //@ts-ignore: duplex is not in the types. See https://github.com/node-fetch/node-fetch/issues/1769
            duplex: isStream ? "half" : undefined,
            body: isStream ? source.stream : source,
            headers: {
                'Content-Type': mime_type || 'application/octet-stream'
            }
        }).then((res: Response) => {
            if (res.ok) {
                return res;
            } else {
                console.log(res);
                throw new Error(`Failed to upload file: ${res.statusText}`);
            }
        });*/

        const res = await fetch(url, {
            method: "PUT",
            body: isStream ? source.stream : source,
            //@ts-ignore: duplex is not in the types. See https://github.com/node-fetch/node-fetch/issues/1769
            duplex: isStream ? "half" : undefined,
            headers: sourceMimeType ? { "Content-Type": sourceMimeType } : undefined,
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
                console.error("Failed to upload file", err);
                throw err;
            });

        //Etag need to be unquoted
        //When a server returns an ETag header, it includes the quotes around the actual hash value.
        //This is part of the HTTP specification (RFC 7232), which states that ETags should be
        //enclosed in double quotes.
        const etag = res.headers.get("etag")?.replace(/^"(.*)"$/, "$1");

        return {
            source: id,
            name: source.name,
            type: sourceMimeType,
            etag,
        };
    }

    async create(
        payload: CreateContentObjectPayload,
        options?: {
            collection_id?: string;
            processing_priority?: ContentObjectProcessingPriority;
        },
    ): Promise<ContentObject> {
        const createPayload: CreateContentObjectPayload = {
            ...payload,
        };
        if (
            payload.content instanceof StreamSource ||
            payload.content instanceof File
        ) {
            createPayload.content = await this.upload(payload.content);
        }

        const headers: Record<string, string> = {};
        if (options?.processing_priority) {
            headers[ContentObjectApiHeaders.PROCESSING_PRIORITY] = options.processing_priority;
        }
        if (options?.collection_id) {
            headers[ContentObjectApiHeaders.COLLECTION_ID] = options.collection_id;
        }

        return await this.post("/", {
            payload: createPayload,
            headers: headers,
        });
    }

    /**
     * Create an object which holds a reference to an external blob (i.e. not in the project bucket)
     * The uri should starts either with gs:// or s3://. Not other protocols are supported yet.
     * For the s3 blobs you must use a hash with the blob #region. Ex: s3://bucket/path/to/file#us-east-1
     * @param uri
     * @param payload
     * @param options
     * @returns
     */
    async createFromExternalSource(
        uri: string,
        payload: CreateContentObjectPayload = {},
        options?: {
            collection_id?: string;
            processing_priority?: ContentObjectProcessingPriority;
        },
    ): Promise<ContentObject> {
        const metadata = await (this.client as ZenoClient).files.getMetadata(
            uri,
        );
        const createPayload: CreateContentObjectPayload = {
            ...payload,
            content: {
                source: uri,
                name: metadata.name,
                type: metadata.contentType,
                etag: metadata.etag,
            },
        };

        const headers: Record<string, string> = {};
        if (options?.processing_priority) {
            headers[ContentObjectApiHeaders.PROCESSING_PRIORITY] = options.processing_priority;
        }
        if (options?.collection_id) {
            headers[ContentObjectApiHeaders.COLLECTION_ID] = options.collection_id;
        }

        return await this.post("/", {
            payload: createPayload,
            headers: headers,
        });
    }

    /**
     * Updates an existing object or creates a new revision
     * Handles file uploads similar to the create method
     *
     * @param id The ID of the object to update
     * @param payload The changes to apply
     * @param options Additional options
     * @param options.createRevision Whether to create a new revision instead of updating in place
     * @param options.revisionLabel Optional label for the revision (e.g., "v1.2")
     * @param options.suppressWorkflows When true, prevents this update from triggering workflow rules
     * @returns The updated object or newly created revision
     */
    async update(
        id: string,
        payload: Partial<CreateContentObjectPayload>,
        options?: {
            createRevision?: boolean;
            revisionLabel?: string;
            processing_priority?: ContentObjectProcessingPriority;
            suppressWorkflows?: boolean;
            /** If provided, the server will reject the update with 412 if the document's content etag no longer matches. */
            ifMatch?: string;
        },
    ): Promise<ContentObject> {
        const updatePayload: Partial<CreateContentObjectPayload> = {
            ...payload,
        };

        // Handle file upload if content is provided as File or StreamSource
        if (
            payload.content instanceof StreamSource ||
            payload.content instanceof File
        ) {
            updatePayload.content = await this.upload(payload.content);
        }

        const headers: Record<string, string> = {};
        if (options?.ifMatch) {
            headers['if-match'] = options.ifMatch;
        }
        if (options?.processing_priority) {
            headers[ContentObjectApiHeaders.PROCESSING_PRIORITY] = options.processing_priority;
        }
        if (options?.createRevision) {
            headers[ContentObjectApiHeaders.CREATE_REVISION] = "true";
            if (options.revisionLabel) {
                headers[ContentObjectApiHeaders.REVISION_LABEL] = options.revisionLabel;
            }
        }
        if (options?.suppressWorkflows) {
            headers[ContentObjectApiHeaders.SUPPRESS_WORKFLOWS] = "true";
        }

        return this.put(`/${id}`, {
            payload: updatePayload,
            headers,
        });
    }

    /**
     * Retrieves all revisions of a content object
     *
     * @param id The ID of any revision in the object's history
     * @returns Array of all revisions sharing the same root
     */
    getRevisions(id: string): Promise<ContentObjectItem[]> {
        return this.get(`/${id}/revisions`);
    }

    /**
     * Retrieves all collections that contain a specific object
     *
     * @param id The ID of the object
     * @returns Array of collections containing this object (both static and dynamic)
     */
    getCollections(id: string): Promise<any[]> {
        return this.get(`/${id}/collections`);
    }

    delete(id: string): Promise<{ id: string }> {
        return this.del(`/${id}`);
    }

    listWorkflowRuns(documentId: string): Promise<ListWorkflowRunsResponse> {
        return this.get(`/${documentId}/workflow-runs`);
    }

    listRenditions(documentId: string): Promise<ContentObjectItem[]> {
        return this.get(`/${documentId}/renditions`);
    }

    getRendition(
        documentId: string,
        options: GetRenditionParams,
    ): Promise<GetRenditionResponse> {
        const query = {
            max_hw: options.max_hw,
            generate_if_missing: options.generate_if_missing,
            sign_url: options.sign_url,
            block_on_generation: options.block_on_generation,
        };

        return this.get(`/${documentId}/renditions/${options.format}`, {
            query,
        });
    }

    /**
     * Get rendition with pre-validation of content type compatibility.
     * Returns null instead of throwing if the format is not supported for the content type.
     *
     * @param documentId - The document ID
     * @param contentType - The content type of the document (e.g., 'image/png', 'text/markdown')
     * @param options - Rendition options including format
     * @returns The rendition response, or null if format is not supported for the content type
     *
     * @example
     * const rendition = await client.objects.getRenditionSafe(docId, doc.content?.type, {
     *     format: ImageRenditionFormat.jpeg,
     *     generate_if_missing: true
     * });
     * if (!rendition) {
     *     console.log('Document does not support JPEG renditions');
     * }
     */
    getRenditionSafe(
        documentId: string,
        contentType: string | undefined,
        options: GetRenditionParams,
    ): Promise<GetRenditionResponse | null> {
        if (!canGenerateRendition(contentType, options.format)) {
            return Promise.resolve(null);
        }
        return this.getRendition(documentId, options);
    }

    exportProperties(
        payload: ExportPropertiesPayload,
    ): Promise<ExportPropertiesResponse> {
        return this.post("/export", {
            payload,
        });
    }

    setEmbedding(
        id: string,
        type: SupportedEmbeddingTypes,
        payload: Embedding,
    ): Promise<Record<SupportedEmbeddingTypes, Embedding>> {
        return this.put(`/${id}/embeddings/${type}`, {
            payload,
        });
    }
}
