import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZenoClient } from './client.js';

describe('FilesApi', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('retries signed upload URL creation after a transient connection failure', async () => {
        let attempts = 0;
        const fetchSignedUploadUrl = async (): Promise<Response> => {
            attempts++;
            if (attempts === 1) {
                throw new TypeError('fetch failed');
            }
            return new Response(
                JSON.stringify({ id: 'file-1', path: 'agents/run/conversation.json', url: 'https://signed' }),
                {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                },
            );
        };

        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'token',
            fetch: fetchSignedUploadUrl,
        });

        const result = await client.files.getUploadUrl({
            name: 'conversation.json',
            id: 'agents/run/conversation.json',
        });

        expect(result).toEqual({ id: 'file-1', path: 'agents/run/conversation.json', url: 'https://signed' });
        expect(attempts).toBe(2);
    });

    it('retries signed upload URL creation after a transient 503', async () => {
        let attempts = 0;
        const fetchSignedUploadUrl = async (): Promise<Response> => {
            attempts++;
            if (attempts === 1) {
                return new Response(JSON.stringify({ message: 'try again' }), {
                    status: 503,
                    headers: { 'content-type': 'application/json' },
                });
            }
            return new Response(
                JSON.stringify({ id: 'file-1', path: 'agents/run/conversation.json', url: 'https://signed' }),
                {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                },
            );
        };

        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'token',
            fetch: fetchSignedUploadUrl,
        });

        const result = await client.files.getUploadUrl({
            name: 'conversation.json',
            id: 'agents/run/conversation.json',
        });

        expect(result).toEqual({ id: 'file-1', path: 'agents/run/conversation.json', url: 'https://signed' });
        expect(attempts).toBe(2);
    });

    it('does not expose a signed URL when a file download returns 404', async () => {
        const signedUrl =
            'https://storage.googleapis.com/test-bucket/agents/run/files/missing.png?X-Goog-Credential=secret&X-Goog-Signature=do-not-log';
        const fetchDownloadUrl = (): Promise<Response> =>
            Promise.resolve(
                new Response(JSON.stringify({ url: signedUrl }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                }),
            );
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404, statusText: 'Not Found' })));
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'token',
            fetch: fetchDownloadUrl,
        });

        const error = await client.files.downloadFile('agents/run/files/missing.png').catch((cause: unknown) => cause);

        expect(error).toMatchObject({
            name: 'FileDownloadError',
            status: 404,
            message: 'File download not found: agents/run/files/missing.png',
        });
        expect(String(error)).not.toContain('X-Goog-Credential');
        expect(String(error)).not.toContain('X-Goog-Signature');
        expect(String(error)).not.toContain('do-not-log');
        expect(consoleError).not.toHaveBeenCalled();
    });
});
