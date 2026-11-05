import { describe, expect, it } from 'vitest';
import type { UploadSession } from '../store/store.js';
import { ApiSchemaComponents, validateApiRequest, validateApiResponse } from './registry.js';

const session = {
    id: 's3://bucket/big.bin',
    path: 'bucket/big.bin',
    mime_type: 'video/mp4',
    part_size: 16 * 1024 * 1024,
};

describe('upload session components', () => {
    it('publishes the session as a union discriminated by protocol', () => {
        const union = ApiSchemaComponents.UploadSession;
        expect(union.discriminator).toEqual({
            propertyName: 'protocol',
            mapping: {
                gcs_resumable: '#/components/schemas/GcsResumableUploadSession',
                azure_block_blob: '#/components/schemas/AzureBlockBlobUploadSession',
                s3_multipart: '#/components/schemas/S3MultipartUploadSession',
            },
        });
    });

    it.each<UploadSession>([
        { protocol: 's3_multipart', ...session, upload_id: 'u-1' },
        { protocol: 'gcs_resumable', ...session, url: 'https://storage.googleapis.com/upload/x' },
        { protocol: 'azure_block_blob', ...session, url: 'https://a.blob.core.windows.net/c/b?sig=x' },
    ])('accepts a $protocol session', (value) => {
        expect(validateApiResponse('UploadSession', value).valid).toBe(true);
    });

    it.each([
        ['an S3 session without its upload ID', { protocol: 's3_multipart', ...session }],
        ['a GCS session carrying an upload ID', { protocol: 'gcs_resumable', ...session, url: 'u', upload_id: 'x' }],
        ['an unknown protocol', { protocol: 'ftp', ...session, url: 'u' }],
    ])('rejects %s', (_name, value) => {
        expect(validateApiResponse('UploadSession', value).valid).toBe(false);
    });

    it.each([
        ['no part numbers', []],
        ['part 0', [0]],
        ['part 10,001', [10_001]],
        ['a fractional part', [1.5]],
        ['101 parts in one request', Array.from({ length: 101 }, (_, i) => i + 1)],
    ])('rejects a part URL request for %s', (_name, part_numbers) => {
        expect(validateApiRequest('GetUploadPartUrlsPayload', { id: 'x', upload_id: 'u', part_numbers }).valid).toBe(
            false,
        );
    });

    it('accepts a completion of 10,000 parts and rejects an empty one', () => {
        const parts = Array.from({ length: 10_000 }, (_, i) => ({ part_number: i + 1, etag: `"e${i}"` }));
        expect(validateApiRequest('CompleteUploadSessionPayload', { id: 'x', upload_id: 'u', parts }).valid).toBe(true);
        expect(validateApiRequest('CompleteUploadSessionPayload', { id: 'x', upload_id: 'u', parts: [] }).valid).toBe(
            false,
        );
    });

    it('rejects an undeclared field when starting a session', () => {
        expect(validateApiRequest('CreateUploadSessionPayload', { name: 'a.bin', ttl: 60 }).valid).toBe(false);
        expect(validateApiRequest('CreateUploadSessionPayload', { name: 'a.bin' }).valid).toBe(true);
    });
});
