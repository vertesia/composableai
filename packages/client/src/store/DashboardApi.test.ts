import type { DashboardExport } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { ZenoClient } from './client.js';

interface RecordedRequest {
    url: string;
    method: string;
    storeHeader: string | null;
    body: unknown;
}

const EXPORT: DashboardExport = {
    export_id: 'export-1',
    url: 'https://storage.test/export-1.png',
    content_type: 'image/png',
    expires_at: '2026-10-26T12:00:00.000Z',
    width: 800,
    height: 600,
    row_count: 3,
};

function recordingClient() {
    const requests: RecordedRequest[] = [];
    const fetchExport = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const request = new Request(input, init);
        requests.push({
            url: request.url,
            method: request.method,
            storeHeader: request.headers.get('x-data-store-id'),
            body: JSON.parse(await request.text()),
        });
        return new Response(JSON.stringify(EXPORT), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        });
    };
    const client = new ZenoClient({ serverUrl: 'https://store.test', apikey: 'token', fetch: fetchExport });
    return { client, requests };
}

describe('DashboardApi export', () => {
    it('exports a saved dashboard as POST {store}/dashboards/{id}/export', async () => {
        const { client, requests } = recordingClient();

        const result = await client.data
            .dashboards('store-1')
            .export('dashboard-1', { parameter_values: { region: 'EU' }, scale: 2 });

        expect(result).toEqual(EXPORT);
        expect(requests).toEqual([
            {
                url: 'https://store.test/api/v1/data/store-1/dashboards/dashboard-1/export',
                method: 'POST',
                storeHeader: 'store-1',
                body: { parameter_values: { region: 'EU' }, scale: 2 },
            },
        ]);
    });

    it('sends an empty payload when a saved dashboard is exported without options', async () => {
        const { client, requests } = recordingClient();

        await client.data.dashboards('store-1').export('dashboard-1');

        expect(requests[0].body).toEqual({});
    });

    it('exports an unsaved dashboard as POST {store}/dashboards/export', async () => {
        const { client, requests } = recordingClient();
        const payload = { query: 'SELECT 1 AS value', spec: { mark: 'bar' } };

        const result = await client.data.dashboards('store-1').exportPreview(payload);

        expect(result).toEqual(EXPORT);
        expect(requests).toEqual([
            {
                url: 'https://store.test/api/v1/data/store-1/dashboards/export',
                method: 'POST',
                storeHeader: 'store-1',
                body: payload,
            },
        ]);
    });
});
