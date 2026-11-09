import { afterEach, describe, expect, it, vi } from 'vitest';
import { VertesiaClient, type VertesiaClientProps } from './client.js';

function jsonResponse(payload: unknown) {
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
}

const urls = { serverUrl: 'https://studio.example.com', storeUrl: 'https://store.example.com' };

/** Pretend to run in a browser for the duration of one test. */
function inBrowser() {
    vi.stubGlobal('window', { document: {} });
}

describe('VertesiaClient in-flight deduplication', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('is off by default outside a browser', () => {
        const client = new VertesiaClient(urls);
        expect(client.getInFlightRequests()).toBeUndefined();
        expect(client.store.getInFlightRequests()).toBeUndefined();
    });

    it('is on by default in a browser, with one table shared by the studio and store clients', () => {
        inBrowser();
        const client = new VertesiaClient(urls);
        expect(client.getInFlightRequests()).toBeDefined();
        expect(client.store.getInFlightRequests()).toBe(client.getInFlightRequests());
    });

    it.each<[string, Partial<VertesiaClientProps>]>([
        ['onRequest', { onRequest: () => {} }],
        ['requestIdentity', { requestIdentity: () => 'id' }],
        ['a custom fetch', { fetch: async () => jsonResponse({}) }],
    ])('is off by default in a browser when the client has %s', (_name, extra) => {
        inBrowser();
        const client = new VertesiaClient({ ...urls, ...extra });
        expect(client.getInFlightRequests()).toBeUndefined();
    });

    it('can be turned on explicitly anywhere, sharing concurrent identical GETs', async () => {
        const fetchMock = vi.fn(async (input: Request | string | URL) => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            return jsonResponse({ url });
        });
        const client = new VertesiaClient({ ...urls, fetch: fetchMock, inFlightDeduplication: true });

        const [a, b] = await Promise.all([client.projects.retrieve('p1'), client.projects.retrieve('p1')]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(a).toEqual(b);
        expect(a).not.toBe(b);
    });

    it('can be turned off explicitly in a browser', () => {
        inBrowser();
        const client = new VertesiaClient({ ...urls, inFlightDeduplication: false });
        expect(client.getInFlightRequests()).toBeUndefined();
        expect(client.store.getInFlightRequests()).toBeUndefined();
    });

    it('takes options that turn it on and report duplicates', async () => {
        const onDuplicate = vi.fn();
        const fetchMock = vi.fn(async () => jsonResponse({}));
        const client = new VertesiaClient({ ...urls, fetch: fetchMock, inFlightDeduplication: { onDuplicate } });
        expect(client.store.getInFlightRequests()).toBe(client.getInFlightRequests());

        await Promise.all([client.projects.retrieve('p1'), client.projects.retrieve('p1')]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(onDuplicate).toHaveBeenCalledTimes(1);
        expect(onDuplicate).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                path: 'https://studio.example.com/api/v1/projects/p1',
                shared: true,
            }),
        );
    });

    it('shares the table with the OAuth API, so a write through the main client invalidates its GETs', async () => {
        const answers: Array<() => void> = [];
        const fetchMock = vi.fn(
            (input: Request | string | URL) =>
                new Promise<Response>((resolve) => {
                    const req = input as Request;
                    answers.push(() => resolve(jsonResponse({ method: req.method })));
                }),
        );
        const client = new VertesiaClient({ ...urls, fetch: fetchMock, inFlightDeduplication: true });
        expect(client.oauthServer.getInFlightRequests()).toBe(client.getInFlightRequests());

        const before = client.oauthServer.get('/clients/c1');
        const write = client.projects.update('p1', { name: 'renamed' });
        const after = client.oauthServer.get('/clients/c1');
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
        const methods = fetchMock.mock.calls.map(([input]) => (input as Request).method);
        expect(methods.filter((m) => m === 'GET')).toHaveLength(2);
        for (const answer of answers) answer();
        await Promise.all([before, write, after]);
    });
});
