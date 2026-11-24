import { describe, expect, it, vi } from 'vitest';
import {
    isContentSha256Rejected,
    matchesStoredContent,
    sha256Hex,
    uploadWithContentSha256,
    withContentSha256,
    writeWithContentSha256,
} from './contentChecksum';

const MD5 = '0123456789abcdef0123456789abcdef';
const SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

function requestError(status: number, message: string): Error {
    return Object.assign(new Error(message), { status, payload: { error: message } });
}

describe('sha256Hex', () => {
    it('returns the lowercase hex SHA-256 of the bytes', async () => {
        await expect(sha256Hex(new TextEncoder().encode('abc').buffer as ArrayBuffer)).resolves.toBe(SHA256);
    });
});

describe('withContentSha256', () => {
    it('adds the SHA-256 when it was computed', () => {
        expect(withContentSha256({ source: 'f', etag: 'kms-etag' }, SHA256)).toEqual({
            source: 'f',
            etag: 'kms-etag',
            sha256: SHA256,
        });
    });

    it('leaves the source as it is without one', () => {
        const uploaded = { source: 'f', etag: MD5 };
        expect(withContentSha256(uploaded, undefined)).toBe(uploaded);
    });
});

describe('uploadWithContentSha256', () => {
    it('uploads the file and adds its SHA-256', async () => {
        const file = new File(['x'], 'a.txt');
        const upload = vi.fn().mockResolvedValue({ source: 'f', etag: 'kms-etag' });
        await expect(uploadWithContentSha256({ upload }, file, SHA256)).resolves.toEqual({
            source: 'f',
            etag: 'kms-etag',
            sha256: SHA256,
        });
        expect(upload).toHaveBeenCalledWith(file);
    });
});

describe('matchesStoredContent', () => {
    it('compares an object that stores a SHA-256 on it, not on its etag', () => {
        expect(matchesStoredContent({ hash: MD5, sha256: SHA256 }, { etag: 'kms-etag', sha256: SHA256 })).toBe(true);
        expect(matchesStoredContent({ hash: MD5, sha256: 'f'.repeat(64) }, { etag: MD5, sha256: SHA256 })).toBe(false);
    });

    it('compares an older object on its etag', () => {
        expect(matchesStoredContent({ hash: MD5, sha256: SHA256 }, { etag: MD5 })).toBe(true);
        expect(matchesStoredContent({ hash: MD5, sha256: SHA256 }, { etag: 'other' })).toBe(false);
    });

    it('never matches on a hash that was not computed', () => {
        expect(matchesStoredContent({}, { etag: 'legacy-etag' })).toBe(false);
        expect(matchesStoredContent({}, {})).toBe(false);
        expect(matchesStoredContent({ hash: MD5 }, { etag: 'kms-etag', sha256: SHA256 })).toBe(false);
        expect(matchesStoredContent({ hash: '', sha256: '' }, { etag: '' })).toBe(false);
    });
});

describe('isContentSha256Rejected', () => {
    it('recognises a 400 naming sha256', () => {
        const err = requestError(
            400,
            'Request body does not match CreateContentObjectPayload: /content must NOT have additional properties: sha256',
        );
        expect(isContentSha256Rejected(err)).toBe(true);
    });

    it('ignores other errors', () => {
        expect(isContentSha256Rejected(requestError(400, 'name is required'))).toBe(false);
        expect(isContentSha256Rejected(requestError(500, 'sha256'))).toBe(false);
        expect(isContentSha256Rejected('sha256')).toBe(false);
    });
});

describe('writeWithContentSha256', () => {
    it('writes once when the server accepts the SHA-256', async () => {
        const write = vi.fn().mockResolvedValue('ok');
        await expect(writeWithContentSha256({ source: 'f', sha256: SHA256 }, write)).resolves.toBe('ok');
        expect(write).toHaveBeenCalledTimes(1);
        expect(write).toHaveBeenCalledWith({ source: 'f', sha256: SHA256 });
    });

    it('writes again without the SHA-256 when an older server rejects it', async () => {
        const write = vi
            .fn()
            .mockRejectedValueOnce(requestError(400, '/content must NOT have additional properties: sha256'))
            .mockResolvedValueOnce('ok');
        await expect(writeWithContentSha256({ source: 'f', sha256: SHA256 }, write)).resolves.toBe('ok');
        expect(write).toHaveBeenLastCalledWith({ source: 'f' });
    });

    it('rethrows any other failure without retrying', async () => {
        const err = requestError(403, 'forbidden');
        const write = vi.fn().mockRejectedValue(err);
        await expect(writeWithContentSha256({ source: 'f', sha256: SHA256 }, write)).rejects.toBe(err);
        expect(write).toHaveBeenCalledTimes(1);
    });
});
