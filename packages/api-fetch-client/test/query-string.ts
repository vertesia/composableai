import assert from 'node:assert';
import { KoaServer } from '@koa-stack/server';
import { FetchClient } from '../src/index.js';
import { buildQueryString } from '../src/utils.js';
import Endpoints from './endpoints.js';

const HOST = '127.0.0.1';
const server = new KoaServer();

server.mount('/api/v1', Endpoints);

let client: FetchClient;

before(async () => {
    await server.start(0, { host: HOST });
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Unable to resolve test server address');
    }
    client = new FetchClient(`http://${HOST}:${address.port}/api/v1`);
});

after(() => server.stop());

describe('buildQueryString', () => {
    it('repeats the key for an array, as OpenAPI style:form explode:true describes', () => {
        assert.strictEqual(buildQueryString({ tags: ['a', 'b'] }), 'tags=a&tags=b');
    });

    it('emits a one-element array as a single occurrence', () => {
        assert.strictEqual(buildQueryString({ tags: ['a'] }), 'tags=a');
    });

    it('emits an empty array as nothing at all', () => {
        assert.strictEqual(buildQueryString({ tags: [] }), '');
    });

    it('keeps scalars unchanged', () => {
        assert.strictEqual(buildQueryString({ limit: 10, name: 'x', flag: false }), 'limit=10&name=x&flag=false');
    });

    it('drops a nullish parameter and a nullish array element', () => {
        assert.strictEqual(buildQueryString({ a: undefined, b: null, c: 'c' }), 'c=c');
        assert.strictEqual(buildQueryString({ tags: ['a', null, undefined, 'b'] }), 'tags=a&tags=b');
    });

    it('encodes a comma inside a value rather than emitting it as a separator', () => {
        // The comma-joined serializer this replaces sent `['a,b']` and `['a', 'b']` identically, so
        // the two were indistinguishable on the wire. They are distinct now. Servers still split on
        // commas to keep reading older SDKs, so a comma-containing value is not yet round-trippable
        // end to end — retiring that split is what finally makes it one.
        assert.strictEqual(buildQueryString({ tags: ['a,b'] }), 'tags=a%2Cb');
    });

    it('encodes keys and values', () => {
        assert.strictEqual(buildQueryString({ 'a b': ['c d', 'e&f'] }), 'a%20b=c%20d&a%20b=e%26f');
    });
});

describe('array query parameters over the wire', () => {
    it('arrives at the server as an array', async () => {
        const payload = (await client.get('/echo-query', { query: { tags: ['a', 'b'], limit: 10 } })) as {
            query: Record<string, unknown>;
            search: string;
        };
        assert.strictEqual(payload.search, 'tags=a&tags=b&limit=10');
        assert.deepStrictEqual(payload.query.tags, ['a', 'b']);
        assert.strictEqual(payload.query.limit, '10');
    });

    it('arrives as a plain string for a one-element array, which is why servers must accept both', async () => {
        // Koa collapses a single occurrence to a string; there is no wire difference between
        // `{tags: 'a'}` and `{tags: ['a']}`. `queryStringList` on the server normalizes it back.
        const payload = (await client.get('/echo-query', { query: { tags: ['a'] } })) as {
            query: Record<string, unknown>;
        };
        assert.strictEqual(payload.query.tags, 'a');
    });

    it('keeps a comma inside a value distinct from a separator at the wire level', async () => {
        // Two occurrences reach the server, the first still holding its comma. `queryStringList` then
        // splits it back into three for the benefit of older SDKs — but the distinction now exists in
        // the request, which is the part a server cannot recover on its own.
        const payload = (await client.get('/echo-query', { query: { tags: ['a,b', 'c'] } })) as {
            query: Record<string, unknown>;
        };
        assert.deepStrictEqual(payload.query.tags, ['a,b', 'c']);
    });
});
