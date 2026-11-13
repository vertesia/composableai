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

    it('drops every trailing slash of DATA_SERVER_URL, however many', () => {
        vi.stubEnv('DATA_SERVER_URL', `http://127.0.0.1:8209${'/'.repeat(50_000)}`);
        expect(dataServerBaseUrl('http://localhost:8092')).toBe('http://127.0.0.1:8209');
        expect(dataApiBaseUrl('http://localhost:8092')).toBe('http://127.0.0.1:8209/api/v1/data');
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

describe('a branch environment without a data server', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    /** A client whose derived data server host has no service: the platform's front end answers 404 without a body. */
    function clientWithoutDataServer(serverUrl: string, notFound = () => new Response(null, { status: 404 })) {
        const requests: string[] = [];
        const client = new ZenoClient({
            serverUrl,
            apikey: 'token',
            fetch: vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
                const request = new Request(input, init);
                const url = new URL(request.url);
                requests.push(`${request.method} ${url.origin}${url.pathname}`);
                return url.hostname.startsWith('data-server-') ? notFound() : Response.json({ served: true });
            }),
        });
        return { client, requests };
    }

    it('sends the call again to the store, then every later call straight there', async () => {
        vi.stubEnv('DATA_SERVER_URL', '');
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { client, requests } = clientWithoutDataServer(BRANCH_STORE);

        await expect(client.data.query('store-1', { sql: 'SELECT 1' })).resolves.toEqual({ served: true });
        await client.data.getSchema('store-1');
        await client.data.dashboards('store-1').list();

        expect(requests).toEqual([
            `POST ${BRANCH_DATA_SERVER}/api/v1/data/store-1/query`,
            `POST ${BRANCH_STORE}/api/v1/data/store-1/query`,
            `GET ${BRANCH_STORE}/api/v1/data/store-1/schema`,
            `GET ${BRANCH_STORE}/api/v1/data/store-1/dashboards`,
        ]);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain(new URL(BRANCH_DATA_SERVER).host);
    });

    it('switches once when several calls find no data server at the same time', async () => {
        vi.stubEnv('DATA_SERVER_URL', '');
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { client, requests } = clientWithoutDataServer(BRANCH_STORE);

        const results = await Promise.all([client.data.list(), client.data.getSchema('store-1')]);

        expect(results).toEqual([{ served: true }, { served: true }]);
        expect(requests.filter((request) => request.includes(BRANCH_STORE))).toHaveLength(2);
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('asks the data server again from a new client', async () => {
        vi.stubEnv('DATA_SERVER_URL', '');
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        await clientWithoutDataServer(BRANCH_STORE).client.data.list();
        const { client, requests } = recordingClient(BRANCH_STORE);

        await client.data.list();

        expect(requests.map((request) => request.url)).toEqual([`${BRANCH_DATA_SERVER}/api/v1/data`]);
    });

    it('keeps a 404 that a deployed data server or zeno-server answered', async () => {
        vi.stubEnv('DATA_SERVER_URL', '');
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const body = { error: 'Not Found', status: 404, message: 'Not Found: Data store not found' };
        const answers: Record<string, string>[] = [
            { 'x-service-name': 'data-server' },
            { via: '1.1 google, 2 data-server' },
        ];
        for (const headers of answers) {
            const { client, requests } = clientWithoutDataServer(BRANCH_STORE, () =>
                Response.json(body, { status: 404, headers }),
            );

            await expect(client.data.getSchema('missing')).rejects.toMatchObject({ status: 404 });

            expect(requests).toEqual([`GET ${BRANCH_DATA_SERVER}/api/v1/data/missing/schema`]);
        }
        expect(warn).not.toHaveBeenCalled();
    });

    it('does not fall back from an explicit DATA_SERVER_URL', async () => {
        vi.stubEnv('DATA_SERVER_URL', 'https://data-server-elsewhere.example.com');
        const { client, requests } = clientWithoutDataServer(BRANCH_STORE);

        await expect(client.data.list()).rejects.toMatchObject({ status: 404 });

        expect(requests).toEqual(['GET https://data-server-elsewhere.example.com/api/v1/data']);
    });
});
