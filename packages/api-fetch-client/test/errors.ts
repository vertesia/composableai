import assert from 'node:assert/strict';
import {
    ApiTopic,
    ConnectionError,
    FetchClient,
    RequestError,
    ResponseReadError,
    requestErrorDetail,
} from '../src/index.js';

describe('handled transport failures', () => {
    it('throws a connection error without logging it', async () => {
        const timeout = new Error('request timed out');
        timeout.name = 'TimeoutError';
        class QuietClient extends FetchClient {
            override handleConnectionError(_error: ConnectionError): void {}
        }
        class ItemsApi extends ApiTopic {
            constructor(client: FetchClient) {
                super(client, '/items');
            }
        }
        const client = new QuietClient('https://api.example.test', async () => {
            throw timeout;
        });
        const logged: unknown[][] = [];
        const previous = console.error;
        console.error = (...args: unknown[]) => {
            logged.push(args);
        };
        try {
            await assert.rejects(new ItemsApi(client).get('/'), (error: unknown) => {
                assert.ok(error instanceof ConnectionError);
                assert.ok(!(error instanceof ResponseReadError));
                assert.equal(error.payload, timeout);
                assert.equal(requestErrorDetail(error), 'Failed to connect to server: request timed out');
                return true;
            });
            assert.deepEqual(logged, []);
        } finally {
            console.error = previous;
        }
    });

    for (const name of ['TypeError', 'TimeoutError']) {
        it(`uses the parent's current factory for ${name} after topic construction`, async () => {
            const failure = new Error('transport unavailable');
            failure.name = name;
            class QuietClient extends FetchClient {
                override handleConnectionError(_error: ConnectionError): void {}
            }
            class ItemsApi extends ApiTopic {
                constructor(client: FetchClient) {
                    super(client, '/items');
                }
            }
            const client = new QuietClient('https://api.example.test', async () => {
                throw failure;
            });
            client.withErrorFactory(() => new Error('old factory'));
            const topic = new ItemsApi(client);
            const wrapped = new Error('operation failed');
            let received: RequestError | undefined;
            client.withErrorFactory((error) => {
                received = error;
                return wrapped;
            });
            await assert.rejects(topic.get('/'), (error: unknown) => error === wrapped);
            assert.ok(received instanceof ConnectionError);
            assert.equal(received.payload, failure);
        });
    }

    for (const name of ['TimeoutError', 'AbortError']) {
        it(`uses the current factory for a response-body ${name} without replaying the request`, async () => {
            const failure = new DOMException('body interrupted', name);
            const reported: ConnectionError[] = [];
            class ReportingClient extends FetchClient {
                override handleConnectionError(error: ConnectionError): void {
                    reported.push(error);
                }
            }
            class ItemsApi extends ApiTopic {
                constructor(client: FetchClient) {
                    super(client, '/items');
                }
            }
            let attempts = 0;
            const client = new ReportingClient('https://api.example.test', async () => {
                attempts++;
                return new Response(
                    new ReadableStream({
                        start(controller) {
                            controller.error(failure);
                        },
                    }),
                );
            });
            const topic = new ItemsApi(client);
            client.withRetryPolicy({ attempts: 3, baseDelayMs: 0, jitter: false });
            let received: RequestError | undefined;
            const wrapped = new Error('operation interrupted');
            client.withErrorFactory((error) => {
                received = error;
                return wrapped;
            });
            await assert.rejects(topic.get('/'), (error: unknown) => error === wrapped);
            assert.ok(received instanceof ResponseReadError);
            assert.ok(received instanceof ConnectionError);
            assert.equal(received.status, 0);
            assert.equal(received.responseStatus, 200);
            assert.equal(requestErrorDetail(received), 'Failed to read response body (HTTP 200): body interrupted');
            assert.equal(received.payload, failure);
            assert.equal(attempts, 1);
            assert.deepEqual(reported, name === 'AbortError' ? [] : [received]);
        });
    }

    it('logs what failed by default, for a failed connection and a failed body read', async () => {
        const logged: unknown[][] = [];
        const previous = console.error;
        console.error = (...args: unknown[]) => {
            logged.push(args);
        };
        try {
            const timeout = new DOMException('timed out', 'TimeoutError');
            await assert.rejects(
                new FetchClient('https://api.example.test', async () => {
                    throw timeout;
                }).get('/items'),
                ConnectionError,
            );
            await assert.rejects(
                new FetchClient(
                    'https://api.example.test',
                    async () =>
                        new Response(
                            new ReadableStream({
                                start(controller) {
                                    controller.error(timeout);
                                },
                            }),
                            { status: 200 },
                        ),
                ).get('/items'),
                ResponseReadError,
            );
        } finally {
            console.error = previous;
        }
        assert.equal(logged.length, 2);
        assert.match(String(logged[0]?.[0]), /^Failed to connect to server: timed out/);
        assert.match(String(logged[1]?.[0]), /^Failed to read response body \(HTTP 200\): timed out/);
        assert.match(String(logged[1]?.[0]), /https:\/\/api\.example\.test\/items/);
        assert.doesNotMatch(String(logged[1]?.[0]), /Failed to connect/);
    });

    it('does not wrap application or custom-reader errors a second time', async () => {
        const client = new FetchClient('https://api.example.test', async () =>
            Response.json({ message: 'denied' }, { status: 403 }),
        );
        let calls = 0;
        const wrapped = new Error('permission denied');
        client.withErrorFactory(() => {
            calls++;
            return wrapped;
        });
        await assert.rejects(client.get('/'), (error: unknown) => error === wrapped);
        assert.equal(calls, 1);
        const readerFailure = new Error('reader failed');
        await assert.rejects(
            client.get('/', {
                reader: () => {
                    throw readerFailure;
                },
            }),
            (error: unknown) => error === readerFailure,
        );
        assert.equal(calls, 1);
    });

    it('retains plain-text and JSON response detail without request metadata', () => {
        const request = new Request('https://api.example.test/items');
        const plain = new RequestError('non-JSON response', request, 401, {
            error: 'Not a valid JSON payload',
            text: 'edge denied',
        });
        assert.equal(requestErrorDetail(plain), 'edge denied');
        const body = { message: 'permission denied', reason: 'missing role' };
        assert.equal(
            requestErrorDetail(new RequestError('permission denied', request, 403, body)),
            JSON.stringify(body),
        );
        assert.equal(requestErrorDetail(new RequestError('not found', request, 404, undefined)), 'not found');
    });
});

describe('typed admission dependency failures', () => {
    it('keeps 503 dependency outages outside the existing pacing/quota metadata union', async () => {
        const client = new FetchClient(
            'https://api.example.test',
            async () =>
                new Response('{}', {
                    status: 503,
                    headers: {
                        'content-type': 'application/json',
                        'x-ratelimit-reason': 'dependency_unavailable',
                        'retry-after': '3',
                    },
                }),
        );
        await assert.rejects(client.get('/'), (error: unknown) => {
            assert.ok(error instanceof RequestError);
            assert.equal(error.rateLimit, undefined);
            assert.deepEqual(error.dependencyUnavailable, { retryAfterMs: 3000 });
            return true;
        });
    });
});
