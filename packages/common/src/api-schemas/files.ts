import { z } from 'zod';

export const StringValueMapSchema = z.object({}).catchall(z.string()).meta({ id: 'StringValueMap' });

export const FileMetadataUpdateResultSchema = z
    .strictObject({
        success: z.boolean(),
        file: z.string(),
    })
    .meta({ id: 'FileMetadataUpdateResult' });

export const FileListResponseSchema = z
    .strictObject({
        files: z.array(z.string()),
    })
    .meta({ id: 'FileListResponse' });

export const GetUploadUrlPayloadSchema = z
    .strictObject({
        name: z.string().min(1),
        id: z.string().optional(),
        mime_type: z.string().optional(),
        ttl: z.number().optional(),
    })
    .meta({ id: 'GetUploadUrlPayload' });

export const FileMetadataResponseSchema = z
    .strictObject({
        name: z.string(),
        size: z.number(),
        contentType: z.string(),
        contentDisposition: z.string().optional(),
        etag: z.string().optional(),
        generation: z.string().optional(),
        customMetadata: StringValueMapSchema.optional(),
    })
    .meta({ id: 'FileMetadataResponse' });

export const GetFileUrlResponseSchema = z
    .strictObject({
        url: z.string(),
        id: z.string(),
        mime_type: z.string().optional(),
        path: z.string(),
    })
    .meta({ id: 'GetFileUrlResponse' });

export const GetFileUrlPayloadSchema = z
    .strictObject({
        file: z.string().min(1),
        name: z.string().optional(),
        disposition: z.enum(['inline', 'attachment']).optional(),
    })
    .meta({ id: 'GetFileUrlPayload' });

export const BulkUploadUrlsResponseSchema = z
    .strictObject({
        files: z.array(GetFileUrlResponseSchema),
    })
    .meta({ id: 'BulkUploadUrlsResponse' });

export const BulkUploadUrlsPayloadSchema = z
    .strictObject({
        files: z
            .array(
                z.strictObject({
                    name: z.string().min(1),
                    mime_type: z.string().optional(),
                    id: z.string().optional(),
                }),
            )
            .min(1)
            .max(10000),
    })
    .meta({ id: 'BulkUploadUrlsPayload' });

export const FileBucketResponseSchema = z
    .strictObject({
        bucket: z.string(),
        location: z.string().optional(),
    })
    .meta({ id: 'FileBucketResponse' });

export const DeleteFileResultSchema = z
    .strictObject({
        success: z.boolean(),
        count: z.number(),
        message: z.string().optional(),
        file: z.string().optional(),
    })
    .meta({ id: 'DeleteFileResult' });

export const CopyFileResponseSchema = z
    .strictObject({
        success: z.boolean(),
        source: z.string(),
        dest: z.string(),
    })
    .meta({ id: 'CopyFileResponse' });

export const CopyFilePayloadSchema = z
    .strictObject({
        source: z.string().min(1),
        dest: z.string().min(1),
    })
    .meta({ id: 'CopyFilePayload' });

export const SetFileMetadataPayloadSchema = z
    .strictObject({
        file: z.string().min(1).meta({ description: 'The file path (relative to bucket) or full URI' }),
        metadata: StringValueMapSchema.meta({ description: 'Custom metadata key-value pairs to set on the file' }),
    })
    .meta({ id: 'SetFileMetadataPayload' });

/**
 * The file query contracts.
 *
 * `file` and `prefix` are required, which the document already said and each handler restated as its
 * own `ctx.throw(400, 'The … query parameter is required')`. Enforcing the component removes the
 * restatement; the message changes wording and the status does not.
 */
export const FileMetadataQuerySchema = z
    .strictObject({
        file: z.string().min(1),
    })
    .meta({ id: 'FileMetadataQuery' });

export const FileListQuerySchema = z
    .strictObject({
        prefix: z.string(),
    })
    .meta({ id: 'FileListQuery' });

export const FileDeleteQuerySchema = z
    .strictObject({
        prefix: z.boolean().optional(),
    })
    .meta({ id: 'FileDeleteQuery' });

export const BucketReadAccessQuerySchema = z
    .strictObject({
        principal: z.string(),
    })
    .meta({ id: 'BucketReadAccessQuery' });

export const EnsureBucketReadAccessPayloadSchema = BucketReadAccessQuerySchema.meta({
    id: 'EnsureBucketReadAccessPayload',
});

export const EnsureBucketReadAccessResponseSchema = z
    .strictObject({
        bucket: z.string(),
        principal: z.string(),
        granted: z.boolean(),
    })
    .meta({ id: 'EnsureBucketReadAccessResponse' });

export const BucketReadAccessStatusResponseSchema = z
    .strictObject({
        bucket: z.string(),
        principal: z.string(),
        hasAccess: z.boolean(),
    })
    .meta({ id: 'BucketReadAccessStatusResponse' });

export const BucketCreateAccessQuerySchema = z
    .strictObject({
        principal: z.string(),
    })
    .meta({ id: 'BucketCreateAccessQuery' });

export const EnsureBucketCreateAccessPayloadSchema = BucketCreateAccessQuerySchema.meta({
    id: 'EnsureBucketCreateAccessPayload',
});

export const EnsureBucketCreateAccessResponseSchema = z
    .strictObject({
        bucket: z.string(),
        principal: z.string(),
        granted: z.boolean(),
    })
    .meta({ id: 'EnsureBucketCreateAccessResponse' });

export const BucketCreateAccessStatusResponseSchema = z
    .strictObject({
        bucket: z.string(),
        principal: z.string(),
        hasAccess: z.boolean(),
    })
    .meta({ id: 'BucketCreateAccessStatusResponse' });

// Upload sessions: a file too large for one signed PUT is sent in parts through the store's own
// resumable or multipart protocol.

/** S3 numbers the parts of a multipart upload from 1 to 10,000. */
const UploadPartNumberSchema = z.number().int().min(1).max(10000);

export const CreateUploadSessionPayloadSchema = z
    .strictObject({
        name: z.string().min(1),
        id: z.string().optional(),
        mime_type: z.string().optional(),
    })
    .meta({
        id: 'CreateUploadSessionPayload',
        description: 'Starts an upload of a file too large for a single signed PUT.',
    });

const uploadSessionFields = {
    id: z.string().meta({ description: 'Storage URI of the file being uploaded.' }),
    path: z.string(),
    mime_type: z.string().optional(),
    part_size: z
        .number()
        .int()
        .meta({
            description:
                'Bytes per part to start with. GCS chunks are this size. S3 parts and Azure blocks may be larger, to ' +
                'keep within the 10,000 parts S3 allows and the 50,000 blocks Azure does.',
        }),
};

export const GcsResumableUploadSessionSchema = z
    .strictObject({
        protocol: z.literal('gcs_resumable'),
        ...uploadSessionFields,
        url: z.string().meta({
            description:
                'Google Cloud Storage resumable upload session URI. Send the parts with Content-Range; the last one completes the object.',
        }),
    })
    .meta({ id: 'GcsResumableUploadSession' });

export const AzureBlockBlobUploadSessionSchema = z
    .strictObject({
        protocol: z.literal('azure_block_blob'),
        ...uploadSessionFields,
        url: z.string().meta({
            description: 'Azure Blob SAS URL allowing Put Block and Put Block List on the blob.',
        }),
    })
    .meta({ id: 'AzureBlockBlobUploadSession' });

export const S3MultipartUploadSessionSchema = z
    .strictObject({
        protocol: z.literal('s3_multipart'),
        ...uploadSessionFields,
        upload_id: z.string().meta({
            description: 'S3 multipart upload ID. Sign part URLs, then complete or abort the upload with it.',
        }),
    })
    .meta({ id: 'S3MultipartUploadSession' });

export const UploadSessionSchema = z
    .discriminatedUnion('protocol', [
        GcsResumableUploadSessionSchema,
        AzureBlockBlobUploadSessionSchema,
        S3MultipartUploadSessionSchema,
    ])
    .meta({ id: 'UploadSession', description: 'How to send a file in parts to its storage.' });

export const GetUploadPartUrlsPayloadSchema = z
    .strictObject({
        id: z.string().min(1).meta({ description: 'The session id.' }),
        upload_id: z.string().min(1),
        part_numbers: z.array(UploadPartNumberSchema).min(1).max(100),
    })
    .meta({ id: 'GetUploadPartUrlsPayload' });

export const UploadPartUrlSchema = z
    .strictObject({
        part_number: UploadPartNumberSchema,
        url: z.string(),
    })
    .meta({ id: 'UploadPartUrl' });

export const UploadPartUrlsResponseSchema = z
    .strictObject({
        parts: z.array(UploadPartUrlSchema),
    })
    .meta({ id: 'UploadPartUrlsResponse' });

export const CompletedUploadPartSchema = z
    .strictObject({
        part_number: UploadPartNumberSchema,
        etag: z.string().min(1).meta({ description: 'The ETag S3 returned for the part.' }),
    })
    .meta({ id: 'CompletedUploadPart' });

export const CompleteUploadSessionPayloadSchema = z
    .strictObject({
        id: z.string().min(1).meta({ description: 'The session id.' }),
        upload_id: z.string().min(1),
        parts: z.array(CompletedUploadPartSchema).min(1).max(10000),
    })
    .meta({ id: 'CompleteUploadSessionPayload' });

export const CompleteUploadSessionResponseSchema = z
    .strictObject({
        id: z.string(),
        path: z.string(),
        etag: z.string().optional(),
    })
    .meta({ id: 'CompleteUploadSessionResponse' });

export const AbortUploadSessionPayloadSchema = z
    .strictObject({
        id: z.string().min(1).meta({ description: 'The session id.' }),
        upload_id: z.string().min(1),
    })
    .meta({ id: 'AbortUploadSessionPayload' });

export const AbortUploadSessionResponseSchema = z
    .strictObject({
        id: z.string(),
        aborted: z.boolean(),
    })
    .meta({ id: 'AbortUploadSessionResponse' });
