import assert from 'node:assert';
import { FetchClient } from '../src/index.js';
import { KoaServer } from '@koa-stack/server';
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
    client = new FetchClient(`http://${HOST}:${address.port}/api/v1`).withHeaders({
        authorization: 'Bearer 1234',
    });
});

after(() => server.stop());

describe('Test requests', () => {
    it('get method works', (done) => {
        client
            .get('/')
            .then((payload) => {
                assert((payload as { message: string }).message === 'Hello World!');
                done();
            })
            .catch(done);
    });
    it('withHeaders works', (done) => {
        client
            .get('/token')
            .then((payload) => {
                assert((payload as { token: string }).token === '1234');
                done();
            })
            .catch(done);
    });
    it('handles incorrect content type', (done) => {
        client
            .get('/html')
            .then((payload) => {
                assert((payload as { text: string }).text === '<html><body>Hello!</body></html>');
                done();
            })
            .catch(done);
    });
    it('handles errors in incorrect content type', (done) => {
        type FetchErr = {
            payload: { text: string };
            status: number;
            original_message: string;
            message: string;
        };
        client
            .get('/html-error')
            .catch((err: unknown) => {
                const e = err as FetchErr;
                assert(e.payload.text === '<html><body>Error!</body></html>');
                assert(e.status === 401);
                assert(e.original_message.startsWith('Server Error: 401'));
                assert(e.original_message.includes('non-JSON response'));
                assert(!e.message.includes('Unexpected token'));
                done();
            })
            .catch(done);
    });
    it('handles no content', (done) => {
        client
            .get('/no-content')
            .then((payload) => {
                assert(payload === undefined);
                assert(client.response?.status === 204);
                done();
            })
            .catch(done);
    });
    it('does not retry by default', async () => {
        let attempts = 0;
        const noRetryClient = new FetchClient('http://example.test', async () => {
            attempts++;
            return new Response(JSON.stringify({ message: 'unavailable' }), {
                status: 503,
                headers: { 'content-type': 'application/json' },
            });
        });

        let error: unknown;
        try {
            await noRetryClient.get('/unstable');
        } catch (err: unknown) {
            error = err;
        }

        assert.equal(attempts, 1);
        assert.equal((error as { status?: number }).status, 503);
    });
    it('retries opted-in transient responses for idempotent methods', async () => {
        let attempts = 0;
        const retryClient = new FetchClient('http://example.test', async () => {
            attempts++;
            return new Response(JSON.stringify({ attempts }), {
                status: attempts === 1 ? 503 : 200,
                headers: { 'content-type': 'application/json' },
            });
        }).withRetryPolicy({
            attempts: 2,
            baseDelayMs: 0,
            jitter: false,
        });

        const payload = (await retryClient.get('/unstable')) as { attempts: number };

        assert.equal(attempts, 2);
        assert.equal(payload.attempts, 2);
    });
    it('does not retry POST unless the request opts in', async () => {
        let attempts = 0;
        const retryClient = new FetchClient('http://example.test', async () => {
            attempts++;
            return new Response(JSON.stringify({ message: 'unavailable' }), {
                status: 503,
                headers: { 'content-type': 'application/json' },
            });
        }).withRetryPolicy({
            attempts: 2,
            baseDelayMs: 0,
            jitter: false,
        });

        let error: unknown;
        try {
            await retryClient.post('/unstable', { payload: { value: true } });
        } catch (err: unknown) {
            error = err;
        }

        assert.equal(attempts, 1);
        assert.equal((error as { status?: number }).status, 503);
    });
    it('retries POST when the request policy explicitly allows it', async () => {
        let attempts = 0;
        const retryClient = new FetchClient('http://example.test', async () => {
            attempts++;
            return new Response(JSON.stringify({ attempts }), {
                status: attempts === 1 ? 503 : 200,
                headers: { 'content-type': 'application/json' },
            });
        }).withRetryPolicy({
            attempts: 2,
            baseDelayMs: 0,
            jitter: false,
        });

        const payload = (await retryClient.post('/unstable', {
            payload: { value: true },
            retryPolicy: { methods: ['POST'] },
        })) as { attempts: number };

        assert.equal(attempts, 2);
        assert.equal(payload.attempts, 2);
    });
    it('retries opted-in connection errors', async () => {
        let attempts = 0;
        const retryClient = new FetchClient('http://example.test', async () => {
            attempts++;
            if (attempts === 1) {
                throw new TypeError('connection reset');
            }
            return new Response(JSON.stringify({ attempts }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        }).withRetryPolicy({
            attempts: 2,
            baseDelayMs: 0,
            jitter: false,
        });

        const payload = (await retryClient.get('/unstable')) as { attempts: number };

        assert.equal(attempts, 2);
        assert.equal(payload.attempts, 2);
    });
});
