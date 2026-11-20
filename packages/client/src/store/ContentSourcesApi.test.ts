import type { ContentSourceSummary } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { ZenoClient } from './client.js';

const SUMMARY: ContentSourceSummary = {
    id: 'source-1',
    name: 'Legal contracts',
    type: 'sharepoint',
    location_root: '/sharepoint/legal',
    site_url: 'https://contoso.sharepoint.com/sites/legal',
    library_name: 'Contracts',
    folder_path: '',
    sync: { enabled: true, interval_minutes: 60 },
    state: 'waiting',
    last_success_at: '2026-11-19T08:00:00.000Z',
};

describe('ContentSourcesApi.summary', () => {
    it('reads GET /content-sources/summary', async () => {
        const requests: { url: string; method: string }[] = [];
        const fetchSummary = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const request = new Request(input, init);
            requests.push({ url: request.url, method: request.method });
            return new Response(JSON.stringify([SUMMARY]), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        };
        const client = new ZenoClient({ serverUrl: 'https://store.test', apikey: 'token', fetch: fetchSummary });

        await expect(client.contentSources.summary()).resolves.toEqual([SUMMARY]);
        expect(requests).toEqual([{ url: 'https://store.test/api/v1/content-sources/summary', method: 'GET' }]);
    });
});
