import assert from 'node:assert';
import { KoaServer } from '@koa-stack/server';
import {
    FetchClient,
    generateIdempotencyKey,
    IDEMPOTENCY_KEY_HEADER,
    IDEMPOTENCY_STATUS_HEADER,
    RequestError,
} from '../src/index.js';
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
    it('keeps request headers out of serialized request errors', () => {
        const request = new Request('https://example.test/private', {
            headers: { authorization: 'Bearer secret-token' },
        });
        const error = new RequestError('Request failed', request, 500, {});

        assert.equal(error.request, request);
        assert.equal(Object.prototype.propertyIsEnumerable.call(error, 'request'), false);
        assert(!JSON.stringify(error).includes('secret-token'));
    });

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
    it('does not type an unknown 429 as a generic API rate-limit response', async () => {
        const unknownClient = new FetchClient(
            'http://example.test',
            async () =>
                new Response(JSON.stringify({ message: 'provider overloaded' }), {
                    status: 429,
                    headers: { 'content-type': 'application/json', 'retry-after': '1' },
                }),
        );

        let error: unknown;
        try {
            await unknownClient.get('/execute');
        } catch (err: unknown) {
            error = err;
        }

        assert.equal((error as { status?: number }).status, 429);
        assert.equal((error as { rateLimit?: unknown }).rateLimit, undefined);
        assert.equal((error as { retryAfterMs?: number }).retryAfterMs, 1_000);
    });
    it('preserves an exact generic retry delay without typing it as an API quota response', async () => {
        const unknownClient = new FetchClient(
            'http://example.test',
            async () =>
                new Response(JSON.stringify({ message: 'provider overloaded' }), {
                    status: 429,
                    headers: {
                        'content-type': 'application/json',
                        'retry-after': '2',
                        'x-retry-after-ms': '1234',
                    },
                }),
        );

        await assert.rejects(unknownClient.get('/execute'), (error: unknown) => {
            assert.equal((error as { rateLimit?: unknown }).rateLimit, undefined);
            assert.equal((error as { retryAfterMs?: number }).retryAfterMs, 1_234);
            return true;
        });
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
                    'x-ratelimit-resource': 'content_read',
                    'x-ratelimit-window': 'quota',
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
        assert.deepEqual((error as { rateLimit?: unknown }).rateLimit, {
            reason: 'quota',
            retryAfterMs: 3_600_000,
            resource: 'content_read',
            window: 'quota',
        });

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
        assert.deepEqual((slowError as { rateLimit?: unknown }).rateLimit, {
            reason: 'pacing',
            retryAfterMs: 60_000,
            resource: undefined,
            window: undefined,
        });

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
    it('falls back to Retry-After when a pacing 429 has no x-ratelimit-retry-ms', async () => {
        let attempts = 0;
        const startedAt = Date.now();
        const fallbackClient = new FetchClient('http://example.test', async () => {
            attempts++;
            if (attempts === 1) {
                return new Response(JSON.stringify({ error: 'rate_limited_pacing' }), {
                    status: 429,
                    headers: {
                        'content-type': 'application/json',
                        'retry-after': '1',
                        'x-ratelimit-reason': 'pacing',
                        // no x-ratelimit-retry-ms: Number(null) must NOT become a 0ms retry
                    },
                });
            }
            return new Response(JSON.stringify({ attempts }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        });

        const payload = (await fallbackClient.get('/objects')) as { attempts: number };

        assert.equal(attempts, 2);
        assert.equal(payload.attempts, 2);
        // Honored the 1s Retry-After instead of retrying immediately.
        assert.ok(Date.now() - startedAt >= 950);
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
    it('retries non-JSON 5xx (edge/LB error) even when the status is not in the policy', async () => {
        // e.g. Cloud Run "no available instance" returns a 500 HTML page, not a JSON app error.
        let attempts = 0;
        const retryClient = new FetchClient('http://example.test', async () => {
            attempts++;
            if (attempts === 1) {
                return new Response('<html><body>500 Server Error</body></html>', {
                    status: 500,
                    headers: { 'content-type': 'text/html' },
                });
            }
            return new Response(JSON.stringify({ attempts }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        }).withRetryPolicy({ attempts: 2, baseDelayMs: 0, jitter: false });

        const payload = (await retryClient.get('/unstable')) as { attempts: number };

        assert.equal(attempts, 2);
        assert.equal(payload.attempts, 2);
    });
    it('does not retry a JSON 500 (genuine application error)', async () => {
        let attempts = 0;
        const retryClient = new FetchClient('http://example.test', async () => {
            attempts++;
            return new Response(JSON.stringify({ error: 'boom' }), {
                status: 500,
                headers: { 'content-type': 'application/json' },
            });
        }).withRetryPolicy({ attempts: 3, baseDelayMs: 0, jitter: false });

        let error: unknown;
        try {
            await retryClient.get('/app-error');
        } catch (err: unknown) {
            error = err;
        }

        assert.equal(attempts, 1);
        assert.equal((error as { status?: number }).status, 500);
    });
    it('honors retryNonJsonServerErrors:false to opt out of non-JSON 5xx retries', async () => {
        let attempts = 0;
        const retryClient = new FetchClient('http://example.test', async () => {
            attempts++;
            return new Response('<html><body>500 Server Error</body></html>', {
                status: 500,
                headers: { 'content-type': 'text/html' },
            });
        }).withRetryPolicy({ attempts: 3, baseDelayMs: 0, jitter: false, retryNonJsonServerErrors: false });

        let error: unknown;
        try {
            await retryClient.get('/unstable');
        } catch (err: unknown) {
            error = err;
        }

        assert.equal(attempts, 1);
        assert.equal((error as { status?: number }).status, 500);
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

    it('does not report a caller abort as a connection failure', async () => {
        const errors: unknown[][] = [];
        const original = console.error;
        console.error = (...args: unknown[]) => {
            errors.push(args);
        };

        try {
            const abortClient = new FetchClient('http://example.test', async () => {
                throw new DOMException('signal is aborted without reason', 'AbortError');
            });

            await assert.rejects(abortClient.get('/cancelled'));
            assert.deepEqual(errors, [], 'an aborted request must not log to console.error');
        } finally {
            console.error = original;
        }
    });
    it('still reports a genuine connection failure', async () => {
        const errors: unknown[][] = [];
        const original = console.error;
        console.error = (...args: unknown[]) => {
            errors.push(args);
        };

        try {
            const brokenClient = new FetchClient('http://example.test', async () => {
                throw new TypeError('connection reset');
            });

            await assert.rejects(brokenClient.get('/unreachable'));
            assert.equal(errors.length, 1, 'a connection failure must still be reported');
        } finally {
            console.error = original;
        }
    });
    it('does not spend retry attempts on an aborted request', async () => {
        let attempts = 0;
        const abortRetryClient = new FetchClient('http://example.test', async () => {
            attempts++;
            throw new DOMException('signal is aborted without reason', 'AbortError');
        }).withRetryPolicy({
            attempts: 3,
            baseDelayMs: 0,
            jitter: false,
        });

        await assert.rejects(abortRetryClient.get('/cancelled'));
        assert.equal(attempts, 1);
    });
    it('still retries a timeout, which is transient and gets a fresh deadline per attempt', async () => {
        // A timeout is NOT a caller abort. `createRequestInit()` mints a new timeout signal per
        // attempt, so retrying one is meaningful — treating it as terminal made a slow environment
        // fail on the first timeout instead of recovering.
        let attempts = 0;
        const timeoutClient = new FetchClient('http://example.test', async () => {
            attempts++;
            if (attempts === 1) {
                throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
            }
            return new Response(JSON.stringify({ attempts }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        }).withRetryPolicy({ attempts: 2, baseDelayMs: 0, jitter: false });

        const payload = (await timeoutClient.get('/slow')) as { attempts: number };

        assert.equal(attempts, 2);
        assert.equal(payload.attempts, 2);
    });
    it('sends one idempotency key on every attempt of a POST when the policy opts in', async () => {
        const keys: (string | null)[] = [];
        const retryClient = new FetchClient('http://example.test', async (input: unknown) => {
            keys.push((input as Request).headers.get(IDEMPOTENCY_KEY_HEADER));
            return new Response(JSON.stringify({ attempts: keys.length }), {
                status: keys.length === 1 ? 503 : 200,
                headers: { 'content-type': 'application/json' },
            });
        }).withRetryPolicy({ attempts: 3, methods: ['POST'], baseDelayMs: 0, jitter: false, idempotencyKeys: true });

        await retryClient.post('/objects', { payload: { name: 'a' } });
        await retryClient.post('/objects', { payload: { name: 'b' } });

        assert.equal(keys.length, 3);
        assert.match(keys[0] ?? '', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        assert.equal(keys[1], keys[0]);
        assert.notEqual(keys[2], keys[0]);
    });
    it('keeps a caller-supplied idempotency key', async () => {
        const keys: (string | null)[] = [];
        const retryClient = new FetchClient('http://example.test', async (input: unknown) => {
            keys.push((input as Request).headers.get(IDEMPOTENCY_KEY_HEADER));
            return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
        }).withRetryPolicy({ methods: ['POST'], idempotencyKeys: true });

        await retryClient.post('/objects', { payload: {}, headers: { 'Idempotency-Key': 'caller-key' } });

        assert.deepEqual(keys, ['caller-key']);
    });
    it('sends no idempotency key unless the policy opts in and may retry the POST', async () => {
        const keys: (string | null)[] = [];
        const fetchImpl = async (input: unknown) => {
            keys.push((input as Request).headers.get(IDEMPOTENCY_KEY_HEADER));
            return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
        };
        await new FetchClient('http://example.test', fetchImpl)
            .withRetryPolicy({ methods: ['POST'] })
            .post('/objects', { payload: {} });
        const keyedClient = new FetchClient('http://example.test', fetchImpl).withRetryPolicy({
            idempotencyKeys: true,
        });
        // POST is not in the default retry methods, so no attempt would ever reuse the key.
        await keyedClient.post('/objects', { payload: {} });
        await keyedClient.post('/objects', { payload: {}, retryPolicy: false });
        await keyedClient.put('/objects/1', { payload: {} });

        assert.deepEqual(keys, [null, null, null, null]);
    });
    it('retries an in-progress 409 only for a keyed request', async () => {
        let attempts = 0;
        const inProgressThenDone = async () => {
            attempts++;
            if (attempts === 1) {
                return new Response(JSON.stringify({ message: 'in progress' }), {
                    status: 409,
                    headers: { 'content-type': 'application/json', [IDEMPOTENCY_STATUS_HEADER]: 'in-progress' },
                });
            }
            return new Response(JSON.stringify({ attempts }), {
                status: 201,
                headers: { 'content-type': 'application/json' },
            });
        };
        const policy = { attempts: 2, methods: ['POST'], baseDelayMs: 0, jitter: false };

        const keyed = new FetchClient('http://example.test', inProgressThenDone).withRetryPolicy({
            ...policy,
            idempotencyKeys: true,
        });
        const payload = (await keyed.post('/objects', { payload: {} })) as { attempts: number };
        assert.equal(payload.attempts, 2);

        attempts = 0;
        const unkeyed = new FetchClient('http://example.test', inProgressThenDone).withRetryPolicy(policy);
        await assert.rejects(unkeyed.post('/objects', { payload: {} }), (err: unknown) => {
            return (err as { status?: number }).status === 409;
        });
        assert.equal(attempts, 1);
    });
    it('does not retry a 409 the server did not mark as in progress', async () => {
        let attempts = 0;
        const retryClient = new FetchClient('http://example.test', async () => {
            attempts++;
            return new Response(JSON.stringify({ message: 'name taken' }), {
                status: 409,
                headers: { 'content-type': 'application/json' },
            });
        }).withRetryPolicy({ attempts: 3, methods: ['POST'], baseDelayMs: 0, jitter: false, idempotencyKeys: true });

        await assert.rejects(retryClient.post('/objects', { payload: {} }));
        assert.equal(attempts, 1);
    });
    it('generates RFC 4122 version 4 keys', () => {
        const key = generateIdempotencyKey();
        assert.match(key, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        assert.notEqual(generateIdempotencyKey(), key);
    });
});
