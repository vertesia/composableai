import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZenoClient } from './client.js';
import { dataApiBaseUrl, dataServerBaseUrl } from './data-server.js';

const BRANCH_STORE = 'https://zeno-server-dev-feat.api.dev1.vertesia.io';
const BRANCH_DATA_SERVER = 'https://data-server-dev-feat.api.dev1.vertesia.io';

function recordingClient(serverUrl: string) {
    const requests: { url: string; storeHeader: string | null }[] = [];
    const client = new ZenoClient({
        serverUrl,
        apikey: 'token',
        fetch: vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const request = new Request(input, init);
            const url = new URL(request.url);
            requests.push({ url: `${url.origin}${url.pathname}`, storeHeader: request.headers.get('x-data-store-id') });
            return Response.json({});
        }),
    });
    return { client, requests };
}

describe('dataServerBaseUrl', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('derives the data server of a dev-branch store when DATA_SERVER_URL is not set', () => {
        vi.stubEnv('DATA_SERVER_URL', '');
        expect(dataServerBaseUrl(BRANCH_STORE)).toBe(BRANCH_DATA_SERVER);
    });

    it('keeps a branch store on another cloud, which deploys no data server', () => {
        vi.stubEnv('DATA_SERVER_URL', '');
        for (const store of [
            'https://zeno-server-dev-feat.api.dev2.vertesia.io',
            'https://zeno-server-dev-feat.api.dev3.vertesia.io',
            'https://zeno-server.example.com',
        ]) {
            expect(dataServerBaseUrl(store)).toBe(store);
        }
    });

    it('keeps a production, custom or local store, whose own host routes the data store API', () => {
        vi.stubEnv('DATA_SERVER_URL', '');
        expect(dataServerBaseUrl('https://api.vertesia.io')).toBe('https://api.vertesia.io');
        expect(dataServerBaseUrl('https://api.us1.vertesia.io')).toBe('https://api.us1.vertesia.io');
        expect(dataServerBaseUrl('https://store.example.com')).toBe('https://store.example.com');
        expect(dataServerBaseUrl('http://localhost:8092')).toBe('http://localhost:8092');
        expect(dataServerBaseUrl('http://127.0.0.1:8201')).toBe('http://127.0.0.1:8201');
    });

    it('uses DATA_SERVER_URL whatever the store URL, without a trailing slash', () => {
        vi.stubEnv('DATA_SERVER_URL', 'http://127.0.0.1:8209/');
        expect(dataServerBaseUrl('http://localhost:8092')).toBe('http://127.0.0.1:8209');
        expect(dataServerBaseUrl(BRANCH_STORE)).toBe('http://127.0.0.1:8209');
        expect(dataServerBaseUrl('https://api.vertesia.io')).toBe('http://127.0.0.1:8209');
    });

    it('switches the derivation off when DATA_SERVER_URL points back at the store', () => {
        vi.stubEnv('DATA_SERVER_URL', BRANCH_STORE);
        expect(dataServerBaseUrl(BRANCH_STORE)).toBe(BRANCH_STORE);
        expect(dataApiBaseUrl(BRANCH_STORE)).toBe(`${BRANCH_STORE}/api/v1/data`);
    });
});

describe('the data store API base URL', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('sends every DataApi and dashboards call of a dev-branch store to its data server', async () => {
        vi.stubEnv('DATA_SERVER_URL', '');
        const { client, requests } = recordingClient(BRANCH_STORE);

        await client.data.list();
        await client.data.getSchema('store-1');
        await client.data.query('store-1', { sql: 'SELECT 1' });
        await client.data.queryVersion('store-1', 'v1', { sql: 'SELECT 1' });
        await client.data.dashboards('store-1').list();
        await client.objects.retrieve('object-1');

        expect(requests).toEqual([
            { url: `${BRANCH_DATA_SERVER}/api/v1/data`, storeHeader: null },
            { url: `${BRANCH_DATA_SERVER}/api/v1/data/store-1/schema`, storeHeader: 'store-1' },
            { url: `${BRANCH_DATA_SERVER}/api/v1/data/store-1/query`, storeHeader: 'store-1' },
            { url: `${BRANCH_DATA_SERVER}/api/v1/data/store-1/versions/v1/query`, storeHeader: 'store-1' },
            { url: `${BRANCH_DATA_SERVER}/api/v1/data/store-1/dashboards`, storeHeader: 'store-1' },
            // The rest of the store client stays on zeno-server.
            { url: `${BRANCH_STORE}/api/v1/objects/object-1`, storeHeader: null },
        ]);
    });

    it('keeps the store URL for a production store', async () => {
        vi.stubEnv('DATA_SERVER_URL', '');
        const { client, requests } = recordingClient('https://api.vertesia.io');

        await client.data.query('store-1', { sql: 'SELECT 1' });
        await client.data.dashboards('store-1').retrieve('dashboard-1');

        expect(requests.map((request) => request.url)).toEqual([
            'https://api.vertesia.io/api/v1/data/store-1/query',
            'https://api.vertesia.io/api/v1/data/store-1/dashboards/dashboard-1',
        ]);
    });

    it('sends the data store calls of a local store to DATA_SERVER_URL', async () => {
        vi.stubEnv('DATA_SERVER_URL', 'http://127.0.0.1:8209');
        const { client, requests } = recordingClient('http://localhost:8092');

        await client.data.query('store-1', { sql: 'SELECT 1' });
        await client.data.dashboards('store-1').list();

        expect(requests.map((request) => request.url)).toEqual([
            'http://127.0.0.1:8209/api/v1/data/store-1/query',
            'http://127.0.0.1:8209/api/v1/data/store-1/dashboards',
        ]);
    });
});
