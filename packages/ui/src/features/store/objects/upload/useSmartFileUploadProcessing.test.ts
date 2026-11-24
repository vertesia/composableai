import { describe, expect, it } from 'vitest';
import { FileUploadAction, type FileWithMetadata, markExistingByHash } from './useSmartFileUploadProcessing';

const MD5 = '0123456789abcdef0123456789abcdef';
const SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const OTHER_SHA256 = 'f'.repeat(64);

function file(name: string, sha256?: string, hash?: string): FileWithMetadata {
    return { file: new File(['x'], name), name, size: 1, hash, sha256 };
}

describe('markExistingByHash', () => {
    it('skips only the file whose hash matches, in a batch where another file has no hash', () => {
        const unhashed = file('unreadable.pdf');
        const hashed = file('report.pdf', SHA256, MD5);
        markExistingByHash(
            [unhashed, hashed],
            [
                { id: 'legacy', content: { etag: 'legacy-etag' } },
                { id: 'kms', content: { etag: 'kms-etag', sha256: SHA256 } },
            ],
        );
        expect(unhashed.action).toBeUndefined();
        expect(unhashed.existingId).toBeUndefined();
        expect(hashed).toMatchObject({ action: FileUploadAction.SKIP, existingId: 'kms' });
    });

    it('matches an object stored before content.sha256 by its etag', () => {
        const hashed = file('report.pdf', SHA256, MD5);
        markExistingByHash([hashed], [{ id: 'gcs', content: { etag: MD5 } }]);
        expect(hashed).toMatchObject({ action: FileUploadAction.SKIP, existingId: 'gcs' });
    });

    it('marks every file of the batch that holds the bytes of one stored object', () => {
        const first = file('report.pdf', SHA256, MD5);
        const copy = file('report (copy).pdf', SHA256, MD5);
        const other = file('other.pdf', OTHER_SHA256, 'fedcba9876543210fedcba9876543210');
        markExistingByHash([first, copy, other], [{ id: 'kms', content: { etag: 'kms-etag', sha256: SHA256 } }]);
        expect(first).toMatchObject({ action: FileUploadAction.SKIP, existingId: 'kms' });
        expect(copy).toMatchObject({ action: FileUploadAction.SKIP, existingId: 'kms' });
        expect(other.action).toBeUndefined();
    });

    it('still recognises a stored object by its etag when the browser could not compute the SHA-256', () => {
        const noSha256 = file('report.pdf', undefined, MD5);
        markExistingByHash([noSha256], [{ id: 'gcs', content: { etag: MD5, sha256: SHA256 } }]);
        expect(noSha256).toMatchObject({ action: FileUploadAction.SKIP, existingId: 'gcs' });
    });
});
