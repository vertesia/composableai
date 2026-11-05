import { describe, expect, it } from 'vitest';
import { responseBodyLength, StreamSource } from './StreamSource.js';
import { getUploadBody, uploadHeaders } from './store/upload-body.js';

describe('responseBodyLength', () => {
    it.each([
        [{ 'content-length': '1234' }, 1234],
        [{ 'content-length': ' 0 ' }, 0],
        [{ 'content-length': '1234', 'content-encoding': 'identity' }, 1234],
        [{ 'content-length': '1234', 'content-encoding': 'gzip' }, undefined],
        [{ 'content-length': '12.5' }, undefined],
        [{ 'content-length': '-1' }, undefined],
        [{ 'content-length': '99999999999999999999' }, undefined],
        [{}, undefined],
    ])('reads %j as %s', (headers, expected) => {
        const response = new Response(null, { headers });
        expect(responseBodyLength(response)).toBe(expected);
    });
});

describe('upload headers', () => {
    it('declares the length of a stream source with a known size', async () => {
        const upload = await getUploadBody(new StreamSource(new ReadableStream(), 'a.bin', 'video/mp4', undefined, 42));
        expect(uploadHeaders(upload, 'video/mp4')).toEqual({ 'Content-Type': 'video/mp4', 'Content-Length': '42' });
    });

    it('declares no length for a stream of unknown size or a File', async () => {
        const stream = await getUploadBody(new StreamSource(new ReadableStream(), 'a.bin'));
        expect(uploadHeaders(stream, 'text/plain')).toEqual({ 'Content-Type': 'text/plain' });
        const file = await getUploadBody(new File(['x'], 'a.txt'));
        expect(uploadHeaders(file, undefined)).toBeUndefined();
    });
});
