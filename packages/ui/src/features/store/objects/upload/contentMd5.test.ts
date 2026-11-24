import { describe, expect, it, vi } from 'vitest';
import { isContentMd5Rejected, withContentMd5, writeWithContentMd5 } from './contentMd5';

const MD5 = '0123456789abcdef0123456789abcdef';

function requestError(status: number, message: string): Error {
    return Object.assign(new Error(message), { status, payload: { error: message } });
}

describe('withContentMd5', () => {
    it('adds the MD5 when the etag is not the MD5', () => {
        expect(withContentMd5({ source: 'f', etag: 'kms-etag' }, MD5)).toEqual({
            source: 'f',
            etag: 'kms-etag',
            md5: MD5,
        });
    });

    it('leaves the source as it is when the etag is the MD5 or there is no MD5', () => {
        const uploaded = { source: 'f', etag: MD5 };
        expect(withContentMd5(uploaded, MD5)).toBe(uploaded);
        expect(withContentMd5(uploaded, undefined)).toBe(uploaded);
    });
});

describe('isContentMd5Rejected', () => {
    it('recognises a 400 naming md5', () => {
        const err = requestError(
            400,
            'Request body does not match CreateContentObjectPayload: /content must NOT have additional properties: md5',
        );
        expect(isContentMd5Rejected(err)).toBe(true);
    });

    it('ignores other errors', () => {
        expect(isContentMd5Rejected(requestError(400, 'name is required'))).toBe(false);
        expect(isContentMd5Rejected(requestError(500, 'md5'))).toBe(false);
        expect(isContentMd5Rejected('md5')).toBe(false);
    });
});

describe('writeWithContentMd5', () => {
    it('writes once when the server accepts the MD5', async () => {
        const write = vi.fn().mockResolvedValue('ok');
        await expect(writeWithContentMd5({ source: 'f', md5: MD5 }, write)).resolves.toBe('ok');
        expect(write).toHaveBeenCalledTimes(1);
        expect(write).toHaveBeenCalledWith({ source: 'f', md5: MD5 });
    });

    it('writes again without the MD5 when an older server rejects it', async () => {
        const write = vi
            .fn()
            .mockRejectedValueOnce(requestError(400, '/content must NOT have additional properties: md5'))
            .mockResolvedValueOnce('ok');
        await expect(writeWithContentMd5({ source: 'f', md5: MD5 }, write)).resolves.toBe('ok');
        expect(write).toHaveBeenLastCalledWith({ source: 'f' });
    });

    it('rethrows any other failure without retrying', async () => {
        const err = requestError(403, 'forbidden');
        const write = vi.fn().mockRejectedValue(err);
        await expect(writeWithContentMd5({ source: 'f', md5: MD5 }, write)).rejects.toBe(err);
        expect(write).toHaveBeenCalledTimes(1);
    });
});
