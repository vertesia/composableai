import assert from 'node:assert/strict';
import { ApiTopic, ConnectionError, FetchClient, RequestError, requestErrorDetail } from '../src/index.js';

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
                assert.equal(error.payload, timeout);
                assert.equal(requestErrorDetail(error), 'Failed to connect to server: request timed out');
                assert.ok(!requestErrorDetail(error).includes('https://api.example.test'));
                assert.ok(!requestErrorDetail(error).includes('Stack Trace:'));
                return true;
            });
            assert.deepEqual(logged, []);
        } finally {
            console.error = previous;
        }
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
