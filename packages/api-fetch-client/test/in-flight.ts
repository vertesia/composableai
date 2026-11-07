import assert from 'node:assert';
import { ApiTopic, FetchClient, InFlightRequests } from '../src/index.js';

interface PendingCall {
    method: string;
    url: string;
    headers: Record<string, string>;
    resolve: (status: number, payload: unknown) => void;
}

/** A fetch whose responses are released by the test, so requests can be made to overlap on purpose. */
function controlledFetch() {
    const calls: PendingCall[] = [];
    const fetchImpl = (input: Request | string | URL): Promise<Response> => {
        const req = input as Request;
        return new Promise<Response>((resolve, reject) => {
            // Like the real fetch: an aborted signal rejects the request.
            req.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), {
                once: true,
            });
            calls.push({
                method: req.method,
                url: req.url,
                headers: Object.fromEntries(req.headers.entries()),
                resolve: (status, payload) =>
                    resolve(
                        new Response(JSON.stringify(payload), {
                            status,
                            headers: { 'content-type': 'application/json' },
                        }),
                    ),
            });
        });
    };
    return { calls, fetchImpl };
}

/** Lets every queued microtask and macrotask (fetch dispatch, response parsing) run. */
const flush = () => new Promise((r) => setTimeout(r, 0));

/** A client with the default settings (deduplication on), or with it turned off. */
function newClient(enabled = true) {
    const { calls, fetchImpl } = controlledFetch();
    const client = new FetchClient('http://example.test/api', fetchImpl);
    if (!enabled) client.withInFlightDeduplication(false);
    return { client, calls };
}

class ThingsApi extends ApiTopic {
    constructor(client: FetchClient) {
        super(client, '/things');
    }
}

describe('In-flight GET deduplication', () => {
    it('sends concurrent identical GETs once and gives each caller its own copy', async () => {
        const { client, calls } = newClient();
        const a = client.get<{ items: number[] }>('/run/1');
        const b = client.get<{ items: number[] }>('/run/1');
        const c = client.get<{ items: number[] }>('/run/1');
        await flush();
        assert.equal(calls.length, 1);
        calls[0].resolve(200, { items: [1, 2] });
        const [ra, rb, rc] = await Promise.all([a, b, c]);
        assert.deepEqual(ra, { items: [1, 2] });
        assert.deepEqual(rb, ra);
        assert.deepEqual(rc, ra);
        ra.items.push(3);
        assert.deepEqual(rb.items, [1, 2], 'a caller mutating its result must not change another caller result');
        assert.notEqual(rb, rc);
    });

    it('clones for joiners before the first caller can mutate its result', async () => {
        const { client, calls } = newClient();
        const first = client.get<{ items: number[] }>('/run/1').then((result) => {
            result.items.push(99); // mutate as soon as the first caller resumes
            return result;
        });
        const joiner = client.get<{ items: number[] }>('/run/1');
        await flush();
        calls[0].resolve(200, { items: [1] });
        assert.deepEqual((await first).items, [1, 99]);
        assert.deepEqual((await joiner).items, [1]);
    });

    it('is not a cache: a GET after the response settles is sent again', async () => {
        const { client, calls } = newClient();
        const first = client.get('/run/1');
        await flush();
        calls[0].resolve(200, { v: 1 });
        await first;
        const second = client.get('/run/1');
        await flush();
        assert.equal(calls.length, 2);
        calls[1].resolve(200, { v: 2 });
        assert.deepEqual(await second, { v: 2 });
        assert.equal(client.getInFlightRequests()?.size, 0);
    });

    it('keys on the full URL and headers', async () => {
        const { client, calls } = newClient();
        void client.get('/runs', { query: { limit: 10 } });
        void client.get('/runs', { query: { limit: 20 } });
        void client.get('/runs', { query: { limit: 10 }, headers: { 'X-Api-Version': '2' } });
        void client.get('/runs', { query: { limit: 10 }, headers: { 'x-api-version': '2' } });
        await flush();
        assert.equal(calls.length, 3, 'header names are case-insensitive; different values are separate requests');
        for (const call of calls) call.resolve(200, {});
    });

    it('does not let a GET issued after a write join a GET started before it', async () => {
        const { client, calls } = newClient();
        const before = client.get('/run/1');
        await flush();
        const write = client.post('/run/1', { payload: { name: 'renamed' } });
        await flush();
        const after = client.get('/run/1');
        await flush();
        const gets = calls.filter((c) => c.method === 'GET');
        assert.equal(gets.length, 2);
        gets[0].resolve(200, { name: 'old' });
        calls.find((c) => c.method === 'POST')?.resolve(200, { ok: true });
        gets[1].resolve(200, { name: 'renamed' });
        assert.deepEqual(await before, { name: 'old' });
        await write;
        assert.deepEqual(await after, { name: 'renamed' });
    });

    it('does not let a GET issued after a write settles join a GET started during the write', async () => {
        const { client, calls } = newClient();
        const write = client.put('/run/1', { payload: { name: 'renamed' } });
        await flush();
        const during = client.get('/run/1');
        await flush();
        calls.find((c) => c.method === 'PUT')?.resolve(200, { ok: true });
        await write;
        const after = client.get('/run/1');
        await flush();
        const gets = calls.filter((c) => c.method === 'GET');
        assert.equal(gets.length, 2);
        gets[0].resolve(200, { name: 'old' });
        gets[1].resolve(200, { name: 'renamed' });
        assert.deepEqual(await during, { name: 'old' });
        assert.deepEqual(await after, { name: 'renamed' });
    });

    it('is on by default', () => {
        const { client } = newClient();
        assert(client.getInFlightRequests() instanceof InFlightRequests);
    });

    it('can be turned off for a client', async () => {
        const { client, calls } = newClient(false);
        assert.equal(client.getInFlightRequests(), undefined);
        void client.get('/run/1');
        void client.get('/run/1');
        await flush();
        assert.equal(calls.length, 2);
        for (const call of calls) call.resolve(200, {});
    });

    it('does not share requests that opt out, carry a caller signal, or have a payload', async () => {
        const { client, calls } = newClient();
        void client.get('/run/1');
        void client.get('/run/1', { dedupe: false });
        void client.get('/run/1', { signal: new AbortController().signal });
        await flush();
        assert.equal(calls.length, 3);
        for (const call of calls) call.resolve(200, {});
    });

    it('does not share a caller abort with other callers', async () => {
        const { client, calls } = newClient();
        const controller = new AbortController();
        const aborted = client.get('/run/1', { signal: controller.signal });
        const other = client.get('/run/1');
        await flush();
        controller.abort();
        await assert.rejects(aborted);
        calls[calls.length - 1].resolve(200, { ok: true });
        assert.deepEqual(await other, { ok: true });
    });

    it('gives every joined caller the same error, then sends again', async () => {
        const { client, calls } = newClient();
        const a = client.get('/run/1');
        const b = client.get('/run/1');
        await flush();
        assert.equal(calls.length, 1);
        calls[0].resolve(500, { message: 'boom' });
        await assert.rejects(a, /boom/);
        await assert.rejects(b, /boom/);
        const retry = client.get('/run/1');
        await flush();
        assert.equal(calls.length, 2);
        calls[1].resolve(200, { ok: true });
        assert.deepEqual(await retry, { ok: true });
    });

    it('shares through API topics with the root client', async () => {
        const { client, calls } = newClient();
        const topic = new ThingsApi(client);
        void topic.get('/1');
        void client.get('/things/1');
        await flush();
        assert.equal(calls.length, 1);
        void topic.post('/1', { payload: {} });
        await flush();
        void topic.get('/1');
        await flush();
        assert.equal(
            calls.filter((c) => c.method === 'GET').length,
            2,
            'a write through a topic clears the root table',
        );
        for (const call of calls) call.resolve(200, {});
    });

    it('shares one table between clients given the same InFlightRequests', async () => {
        const a = newClient(false);
        const b = newClient(false);
        const shared = new InFlightRequests();
        a.client.withInFlightDeduplication(shared);
        b.client.withInFlightDeduplication(shared);
        void a.client.get('/run/1');
        await flush();
        void b.client.delete('/other/2');
        await flush();
        void a.client.get('/run/1');
        await flush();
        assert.equal(a.calls.length, 2, 'a write through one client clears the GETs of the other');
        for (const call of [...a.calls, ...b.calls]) call.resolve(200, {});
    });

    it('does not evict a newer request when an older one with the same key settles', async () => {
        const table = new InFlightRequests();
        const older = Promise.resolve('older');
        const newer = Promise.resolve('newer');
        table.set('k', older);
        table.set('k', newer); // e.g. the older one fell out of the join window
        table.release('k', older);
        assert.equal(table.get('k'), newer);
    });

    it('sends exactly one GET per key between writes, for random interleavings', async () => {
        for (let round = 0; round < 25; round++) {
            const { client, calls } = newClient();
            const expected: { key: string; epoch: number; result: Promise<unknown> }[] = [];
            let epoch = 0;
            for (let i = 0; i < 40; i++) {
                if (Math.random() < 0.15) {
                    void client.post('/write', { payload: { i } });
                    epoch++;
                } else {
                    const key = `/item/${Math.floor(Math.random() * 4)}`;
                    expected.push({ key, epoch, result: client.get(key) });
                }
                if (Math.random() < 0.3) await flush();
            }
            await flush();
            const distinct = new Set(expected.map((e) => `${e.epoch} ${e.key}`)).size;
            const gets = calls.filter((c) => c.method === 'GET');
            assert(gets.length <= distinct, `round ${round}: ${gets.length} GETs for ${distinct} key/epoch pairs`);
            // Each response carries its URL and the index of the request that produced it.
            for (const [id, call] of calls.entries()) call.resolve(200, { url: new URL(call.url).pathname, id });
            const epochsPerRequest = new Map<number, Set<number>>();
            for (const e of expected) {
                const result = (await e.result) as { url: string; id: number };
                assert.equal(result.url, `/api${e.key}`, 'every caller gets the response for its own key');
                if (!epochsPerRequest.has(result.id)) epochsPerRequest.set(result.id, new Set());
                epochsPerRequest.get(result.id)?.add(e.epoch);
            }
            for (const [id, epochs] of epochsPerRequest) {
                assert.equal(epochs.size, 1, `round ${round}: request ${id} was shared across a write`);
            }
        }
    });

    it('never shares between callers whose auth callback returns different credentials', async () => {
        const { client, calls } = newClient();
        // One long-lived client whose credential depends on who is calling (e.g. per-request context on a server).
        let current = 'Bearer tenant-a';
        client.withAuthCallback(() => Promise.resolve(current));
        const a = client.get('/account');
        current = 'Bearer tenant-b';
        const b = client.get('/account');
        current = 'Bearer tenant-a';
        const a2 = client.get('/account');
        await flush();
        assert.equal(calls.length, 2, 'one request per credential');
        assert.deepEqual(calls.map((c) => c.headers.authorization).sort(), ['Bearer tenant-a', 'Bearer tenant-b']);
        for (const call of calls) call.resolve(200, { who: call.headers.authorization });
        assert.deepEqual(await a, { who: 'Bearer tenant-a' });
        assert.deepEqual(await b, { who: 'Bearer tenant-b' });
        assert.deepEqual(await a2, { who: 'Bearer tenant-a' });
    });

    it('sends unshared when the credential cannot be resolved, and fails as before', async () => {
        const { client, calls } = newClient();
        client.withAuthCallback(() => Promise.reject(new Error('no token')));
        await assert.rejects(client.get('/account'), /no token/);
        await assert.rejects(client.get('/account'), /no token/);
        assert.equal(calls.length, 0);
        assert.equal(client.getInFlightRequests()?.size, 0);
    });

    it('does not let a request join one that started outside the join window', async () => {
        const { client, calls } = newClient();
        client.withInFlightDeduplication(new InFlightRequests(20));
        const stalled = client.get('/run/1'); // never answered
        await flush();
        await new Promise((r) => setTimeout(r, 30));
        const fresh = client.get('/run/1');
        await flush();
        assert.equal(calls.length, 2, 'a stalled request must not hold back later identical GETs');
        calls[1].resolve(200, { ok: true });
        assert.deepEqual(await fresh, { ok: true });
        calls[0].resolve(200, { ok: 'late' });
        assert.deepEqual(await stalled, { ok: 'late' });
        assert.equal(client.getInFlightRequests()?.size, 0, 'the late answer does not evict anything');
    });

    it('does not share requests with their own timeout, retry or pacing options', async () => {
        const { client, calls } = newClient();
        void client.get('/run/1');
        void client.get('/run/1', { timeoutMs: 120_000 });
        void client.get('/run/1', { retryPolicy: { attempts: 3 } });
        void client.get('/run/1', { pacingRetry: false });
        await flush();
        assert.equal(calls.length, 4);
        for (const call of calls) call.resolve(200, {});
    });

    it('fetches again for a joiner when the result cannot be cloned', async () => {
        const { calls, fetchImpl } = controlledFetch();
        class FunctionsClient extends FetchClient {
            jsonParse(text: string) {
                return { ...(JSON.parse(text) as object), describe: () => 'not cloneable' };
            }
        }
        const client = new FunctionsClient('http://example.test/api', fetchImpl);
        const a = client.get<{ v: number }>('/run/1');
        const b = client.get<{ v: number }>('/run/1');
        await flush();
        assert.equal(calls.length, 1);
        calls[0].resolve(200, { v: 1 });
        assert.equal((await a).v, 1);
        await flush();
        assert.equal(calls.length, 2, 'the joiner fetched its own copy');
        calls[1].resolve(200, { v: 2 });
        assert.equal((await b).v, 2);
    });

    it('does not allocate a table for topics, which always use the root table', async () => {
        const { client, calls } = newClient();
        const topic = new ThingsApi(client);
        void topic.get('/1');
        await flush();
        assert.equal(topic.inFlight, undefined);
        assert.equal(topic.getInFlightRequests(), client.getInFlightRequests());
        for (const call of calls) call.resolve(200, {});
    });
});
