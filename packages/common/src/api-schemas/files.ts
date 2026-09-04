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
        name: z.string(),
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
        file: z.string(),
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
        files: z.array(
            z.strictObject({
                name: z.string(),
                mime_type: z.string().optional(),
                id: z.string().optional(),
            }),
        ),
    })
    .meta({ id: 'BulkUploadUrlsPayload' });

export const FileBucketResponseSchema = z
    .strictObject({
        bucket: z.string(),
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
        source: z.string(),
        dest: z.string(),
    })
    .meta({ id: 'CopyFilePayload' });

export const SetFileMetadataPayloadSchema = z
    .strictObject({
        file: z.string().meta({ description: 'The file path (relative to bucket) or full URI' }),
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
        file: z.string(),
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
