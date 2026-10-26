import type { DashboardExport } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { ZenoClient } from './client.js';

interface RecordedRequest {
    url: string;
    method: string;
    storeHeader: string | null;
    body: unknown;
}

const RUNNING: DashboardExport = {
    export_id: 'export-1',
    status: 'running',
    started_at: '2026-10-26T11:00:00.000Z',
};

const COMPLETED: DashboardExport = {
    ...RUNNING,
    status: 'completed',
    completed_at: '2026-10-26T11:00:04.000Z',
    url: 'https://storage.test/export-1.png',
    content_type: 'image/png',
    expires_at: '2026-10-26T12:00:04.000Z',
    width: 800,
    height: 600,
    row_count: 3,
};

/** Answers each request with the next response, repeating the last one. */
function recordingClient(...responses: DashboardExport[]) {
    const requests: RecordedRequest[] = [];
    const fetchExport = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const request = new Request(input, init);
        const text = await request.text();
        requests.push({
            url: request.url,
            method: request.method,
            storeHeader: request.headers.get('x-data-store-id'),
            body: text ? JSON.parse(text) : undefined,
        });
        const response = responses[Math.min(requests.length, responses.length) - 1];
        return new Response(JSON.stringify(response), {
            status: response.status === 'running' ? 202 : 200,
            headers: { 'content-type': 'application/json' },
        });
    };
    const client = new ZenoClient({ serverUrl: 'https://store.test', apikey: 'token', fetch: fetchExport });
    return { client, requests };
}

describe('DashboardApi export', () => {
    it('starts exporting a saved dashboard with POST {store}/dashboards/{id}/export', async () => {
        const { client, requests } = recordingClient(RUNNING);

        const result = await client.data
            .dashboards('store-1')
            .export('dashboard-1', { parameter_values: { region: 'EU' }, scale: 2 });

        expect(result).toEqual(RUNNING);
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
        const { client, requests } = recordingClient(RUNNING);

        await client.data.dashboards('store-1').export('dashboard-1');

        expect(requests[0].body).toEqual({});
    });

    it('starts exporting an unsaved dashboard with POST {store}/dashboards/export', async () => {
        const { client, requests } = recordingClient(RUNNING);
        const payload = { query: 'SELECT 1 AS value', spec: { mark: 'bar' } };

        const result = await client.data.dashboards('store-1').exportPreview(payload);

        expect(result).toEqual(RUNNING);
        expect(requests).toEqual([
            {
                url: 'https://store.test/api/v1/data/store-1/dashboards/export',
                method: 'POST',
                storeHeader: 'store-1',
                body: payload,
            },
        ]);
    });

    it('reads an export with GET {store}/dashboards/exports/{export_id}', async () => {
        const { client, requests } = recordingClient(COMPLETED);

        const result = await client.data.dashboards('store-1').getExport('export-1');

        expect(result).toEqual(COMPLETED);
        expect(requests).toEqual([
            {
                url: 'https://store.test/api/v1/data/store-1/dashboards/exports/export-1',
                method: 'GET',
                storeHeader: 'store-1',
                body: undefined,
            },
        ]);
    });

    it('polls an export until it is no longer running', async () => {
        const { client, requests } = recordingClient(RUNNING, RUNNING, COMPLETED);

        const result = await client.data.dashboards('store-1').waitForExport('export-1', { pollIntervalMs: 1 });

        expect(result).toEqual(COMPLETED);
        expect(requests).toHaveLength(3);
    });

    it('returns a failed export instead of throwing', async () => {
        const failed: DashboardExport = {
            ...RUNNING,
            status: 'failed',
            error: { code: 'spec_invalid', message: 'Unrecognized function: nosuchfn', retryable: false },
        };
        const { client } = recordingClient(failed);

        await expect(client.data.dashboards('store-1').waitForExport('export-1')).resolves.toEqual(failed);
    });

    it('gives up when the export is still running after the timeout', async () => {
        const { client } = recordingClient(RUNNING);

        await expect(
            client.data.dashboards('store-1').waitForExport('export-1', { pollIntervalMs: 1, timeoutMs: 5 }),
        ).rejects.toThrow('Dashboard export export-1 is still running after 5ms');
    });
});

describe('DashboardApi markRendered', () => {
    it('records a render with POST {store}/dashboards/{id}/rendered and accepts an empty 204', async () => {
        const requests: { url: string; method: string; storeHeader: string | null }[] = [];
        const fetchRendered = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const request = new Request(input, init);
            requests.push({
                url: request.url,
                method: request.method,
                storeHeader: request.headers.get('x-data-store-id'),
            });
            return new Response(null, { status: 204 });
        };
        const client = new ZenoClient({ serverUrl: 'https://store.test', apikey: 'token', fetch: fetchRendered });

        await expect(client.data.dashboards('store-1').markRendered('dashboard-1')).resolves.toBeUndefined();

        expect(requests).toEqual([
            {
                url: 'https://store.test/api/v1/data/store-1/dashboards/dashboard-1/rendered',
                method: 'POST',
                storeHeader: 'store-1',
            },
        ]);
    });
});
