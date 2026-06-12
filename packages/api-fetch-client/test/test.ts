import assert from 'node:assert';
import { KoaServer } from '@koa-stack/server';
import { FetchClient } from '../src/index.js';
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
    it('auto-retries pacing 429s with the exact server hint, POST included, without a retry policy', async () => {
        let attempts = 0;
        const startedAt = Date.now();
        const pacingClient = new FetchClient('http://example.test', async () => {
            attempts++;
            if (attempts === 1) {
                return new Response(JSON.stringify({ error: 'rate_limited_pacing' }), {
                    status: 429,
                    headers: {
                        'content-type': 'application/json',
                        'retry-after': '1',
                        'x-ratelimit-reason': 'pacing',
                        'x-ratelimit-retry-ms': '60',
                    },
                });
            }
            return new Response(JSON.stringify({ attempts }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        });

        const payload = (await pacingClient.post('/objects', { payload: { name: 'x' } })) as { attempts: number };

        assert.equal(attempts, 2);
        assert.equal(payload.attempts, 2);
        // Waited the precise ms hint, not the 1s Retry-After.
        assert.ok(Date.now() - startedAt >= 55);
        assert.ok(Date.now() - startedAt < 900);
    });
    it('never auto-retries quota 429s and respects the pacing budget and maxWaitMs', async () => {
        let attempts = 0;
        const quotaClient = new FetchClient('http://example.test', async () => {
            attempts++;
            return new Response(JSON.stringify({ error: 'quota_exceeded' }), {
                status: 429,
                headers: {
                    'content-type': 'application/json',
                    'retry-after': '3600',
                    'x-ratelimit-reason': 'quota',
                },
            });
        });
        let error: unknown;
        try {
            await quotaClient.get('/objects');
        } catch (err: unknown) {
            error = err;
        }
        assert.equal(attempts, 1);
        assert.equal((error as { status?: number }).status, 429);

        // A pacing hint above maxWaitMs surfaces the 429 instead of waiting.
        let slowAttempts = 0;
        const slowClient = new FetchClient('http://example.test', async () => {
            slowAttempts++;
            return new Response(JSON.stringify({ error: 'rate_limited_pacing' }), {
                status: 429,
                headers: {
                    'content-type': 'application/json',
                    'x-ratelimit-reason': 'pacing',
                    'x-ratelimit-retry-ms': '60000',
                },
            });
        });
        let slowError: unknown;
        try {
            await slowClient.get('/objects');
        } catch (err: unknown) {
            slowError = err;
        }
        assert.equal(slowAttempts, 1);
        assert.equal((slowError as { status?: number }).status, 429);

        // Persistent pacing exhausts its independent budget (default 2 retries = 3 attempts max).
        let stubbornAttempts = 0;
        const stubbornClient = new FetchClient('http://example.test', async () => {
            stubbornAttempts++;
            return new Response(JSON.stringify({ error: 'rate_limited_pacing' }), {
                status: 429,
                headers: {
                    'content-type': 'application/json',
                    'x-ratelimit-reason': 'pacing',
                    'x-ratelimit-retry-ms': '10',
                },
            });
        });
        let stubbornError: unknown;
        try {
            await stubbornClient.get('/objects');
        } catch (err: unknown) {
            stubbornError = err;
        }
        assert.equal(stubbornAttempts, 3);
        assert.equal((stubbornError as { status?: number }).status, 429);
    });
    it('pacing can be disabled per client', async () => {
        let attempts = 0;
        const offClient = new FetchClient('http://example.test', async () => {
            attempts++;
            return new Response(JSON.stringify({ error: 'rate_limited_pacing' }), {
                status: 429,
                headers: {
                    'content-type': 'application/json',
                    'x-ratelimit-reason': 'pacing',
                    'x-ratelimit-retry-ms': '10',
                },
            });
        }).withPacingRetry(false);
        let error: unknown;
        try {
            await offClient.get('/objects');
        } catch (err: unknown) {
            error = err;
        }
        assert.equal(attempts, 1);
        assert.equal((error as { status?: number }).status, 429);
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
