import { SupportedEmbeddingTypes } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { ZenoClient } from './client.js';

describe('EmbeddingsApi', () => {
    it('omits the mode by default and sends the explicit sync override when requested', async () => {
        const requests: Request[] = [];
        const client = new ZenoClient({
            serverUrl: 'https://store.example.com',
            apikey: 'token',
            fetch: vi.fn(
                async () =>
                    new Response(JSON.stringify({ status: 'success', message: 'started' }), {
                        status: 200,
                        headers: { 'content-type': 'application/json' },
                    }),
            ),
            onRequest: (request) => requests.push(request),
        });

        await client.embeddings.recalculate(SupportedEmbeddingTypes.text);
        await client.embeddings.recalculate(SupportedEmbeddingTypes.text, { mode: 'sync' });
        // TEMPORARY TEST CONTROL: force flags must reach the server without a sync override.
        await client.embeddings.recalculate(SupportedEmbeddingTypes.image, { force: true, force_renditions: true });

        expect(requests.map(({ url }) => url)).toEqual([
            'https://store.example.com/api/v1/embeddings/text/recalculate',
            'https://store.example.com/api/v1/embeddings/text/recalculate?mode=sync',
            'https://store.example.com/api/v1/embeddings/image/recalculate?force=true&force_renditions=true',
        ]);
    });
});
