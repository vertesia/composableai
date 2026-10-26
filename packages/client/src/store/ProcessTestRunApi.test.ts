import type { SubmitProcessTestRunPayload } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { ZenoClient } from './client.js';

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

const payload: SubmitProcessTestRunPayload = { process: { id: 'sys:noop' }, scenarios: [] };

describe('ProcessTestRunApi.submit', () => {
    it('never replays an unkeyed submission, whatever the client policy', async () => {
        const bodies: string[] = [];
        const client = createRetryingClient(bodies);

        await expect(client.processTestRuns.submit(payload)).rejects.toMatchObject({ status: 503 });
        expect(bodies).toHaveLength(1);
    });

    it('retries a keyed submission with the same body and key', async () => {
        const bodies: string[] = [];
        const client = createRetryingClient(bodies);

        await client.processTestRuns.submit({ ...payload, idempotency_key: 'key-1' });
        expect(bodies).toHaveLength(2);
        expect(bodies[1]).toBe(bodies[0]);
        expect(JSON.parse(bodies[0] ?? '{}')).toMatchObject({ idempotency_key: 'key-1' });
    });
});
