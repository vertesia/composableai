import { describe, expect, it } from 'vitest';
import { FileUploadAction, type FileWithMetadata, markExistingByHash } from './useSmartFileUploadProcessing';

const MD5 = '0123456789abcdef0123456789abcdef';

function file(name: string, hash: string | undefined): FileWithMetadata {
    return { file: new File(['x'], name), name, size: 1, hash };
}

describe('markExistingByHash', () => {
    it('skips only the file whose hash matches, in a batch where another file has no hash', () => {
        const unhashed = file('unreadable.pdf', undefined);
        const hashed = file('report.pdf', MD5);
        markExistingByHash(
            [unhashed, hashed],
            [
                { id: 'legacy', content: { etag: 'legacy-etag' } },
                { id: 'kms', content: { etag: 'kms-etag', md5: MD5 } },
            ],
        );
        expect(unhashed.action).toBeUndefined();
        expect(unhashed.existingId).toBeUndefined();
        expect(hashed).toMatchObject({ action: FileUploadAction.SKIP, existingId: 'kms' });
    });

    it('matches an object by its etag when it has no MD5', () => {
        const hashed = file('report.pdf', MD5);
        markExistingByHash([hashed], [{ id: 'gcs', content: { etag: MD5 } }]);
        expect(hashed).toMatchObject({ action: FileUploadAction.SKIP, existingId: 'gcs' });
    });
});
