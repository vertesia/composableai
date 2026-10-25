import { describe, expect, it, vi } from 'vitest';
import { ZenoClient } from './client.js';

function createClient(requests: Request[]) {
    return new ZenoClient({
        serverUrl: 'https://zeno.example.com',
        fetch: vi.fn(async () => Response.json([])),
        onRequest: (request) => requests.push(request),
    });
}

describe('ProcessApi.list', () => {
    it.each([
        ['canonical', { all_versions: true }],
        ['deprecated', { allVersions: true }],
    ])('maps the %s all-versions option to the wire query', async (_name, query) => {
        const requests: Request[] = [];
        const client = createClient(requests);

        await client.processes.list(query);

        expect(requests[0]?.url).toBe('https://zeno.example.com/api/v1/processes?all_versions=true');
    });
});

/**
 * A client whose own policy retries POST, answered by a server that fails the first attempt with a
 * retryable 503. Records the body of every attempt that reached the server.
 */
function createRetryingClient(bodies: string[]) {
    let attempt = 0;
    return new ZenoClient({
        serverUrl: 'https://zeno.example.com',
        retryPolicy: { attempts: 3, methods: ['POST'], baseDelayMs: 0, jitter: false },
        fetch: vi.fn(async (input: RequestInfo) => {
            bodies.push(input instanceof Request ? await input.text() : '');
            attempt++;
            return attempt === 1
                ? new Response('unavailable', { status: 503 })
                : Response.json({ id: 'run' }, { status: 201 });
        }),
    });
}

describe('ProcessApi.publish', () => {
    it('never replays an unkeyed publish, whatever the client policy', async () => {
        const bodies: string[] = [];
        const client = createRetryingClient(bodies);

        await expect(client.processes.publish('process', { confirmed: true })).rejects.toMatchObject({
            status: 503,
        });
        expect(bodies).toHaveLength(1);
    });

    it('retries a keyed publish with the same body and key', async () => {
        const bodies: string[] = [];
        const client = createRetryingClient(bodies);

        await client.processes.publish('process', { confirmed: true, idempotency_key: 'key-1' });
        expect(bodies).toHaveLength(2);
        expect(bodies[1]).toBe(bodies[0]);
        expect(JSON.parse(bodies[0] ?? '{}')).toMatchObject({ idempotency_key: 'key-1' });
    });
});

describe('ProcessApi.startTestRun', () => {
    const start = { suite_id: 'suite', process_revision_id: 'revision' };

    it('never replays an unkeyed start, whatever the client policy', async () => {
        const bodies: string[] = [];
        const client = createRetryingClient(bodies);

        await expect(client.processes.startTestRun('process', start)).rejects.toMatchObject({ status: 503 });
        expect(bodies).toHaveLength(1);
    });

    it('retries a keyed start with the same body and key', async () => {
        const bodies: string[] = [];
        const client = createRetryingClient(bodies);

        await client.processes.startTestRun('process', { ...start, idempotency_key: 'key-1' });
        expect(bodies).toHaveLength(2);
        expect(bodies[1]).toBe(bodies[0]);
        expect(JSON.parse(bodies[0] ?? '{}')).toMatchObject({ idempotency_key: 'key-1' });
    });
});
