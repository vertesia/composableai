import { describe, expect, it } from 'vitest';
import { ZenoClient } from './client.js';

describe('FilesApi', () => {
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
});
