import type { CreateAgentRunPayload, CreateProcessRunPayload } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { ZenoClient } from './client.js';

/**
 * A client whose own policy retries POST, answered by a server that fails the first attempt with a
 * retryable 503. Records the body of every attempt that reached the server.
 */
function createRetryingClient(bodies: string[], idempotencyKeys = false) {
    let attempt = 0;
    return new ZenoClient({
        serverUrl: 'https://zeno.example.com',
        retryPolicy: { attempts: 3, methods: ['POST'], baseDelayMs: 0, jitter: false, idempotencyKeys },
        fetch: vi.fn(async (input: RequestInfo) => {
            bodies.push(input instanceof Request ? await input.text() : '');
            attempt++;
            return attempt === 1
                ? new Response('unavailable', { status: 503 })
                : Response.json({ id: 'run' }, { status: 200 });
        }),
    });
}

const agentPayload: CreateAgentRunPayload = { interaction: 'sys:GeneralAgent', data: { task: 'hello' } };

describe('AgentsApi.start', () => {
    it('never replays an unkeyed agent start, whatever the client policy', async () => {
        const bodies: string[] = [];
        const client = createRetryingClient(bodies);

        await expect(client.agents.start(agentPayload)).rejects.toMatchObject({ status: 503 });
        expect(bodies).toHaveLength(1);
    });

    it('retries a keyed agent start with the same body and key', async () => {
        const bodies: string[] = [];
        const client = createRetryingClient(bodies);

        await client.agents.start({ ...agentPayload, idempotency_key: 'key-1' });
        expect(bodies).toHaveLength(2);
        expect(bodies[1]).toBe(bodies[0]);
        expect(JSON.parse(bodies[0] ?? '{}')).toMatchObject({ idempotency_key: 'key-1' });
    });

    it('keys and retries an unkeyed agent start when the policy sends idempotency keys', async () => {
        const bodies: string[] = [];
        const client = createRetryingClient(bodies, true);

        await client.agents.start(agentPayload);
        expect(bodies).toHaveLength(2);
        expect(bodies[1]).toBe(bodies[0]);
        expect(JSON.parse(bodies[0] ?? '{}').idempotency_key).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('keeps a caller key when the policy sends idempotency keys', async () => {
        const bodies: string[] = [];
        const client = createRetryingClient(bodies, true);

        await client.agents.start({ ...agentPayload, idempotency_key: 'key-1' });
        expect(JSON.parse(bodies[0] ?? '{}')).toMatchObject({ idempotency_key: 'key-1' });
    });

    it('keeps the client policy for a process start, which takes no key', async () => {
        const bodies: string[] = [];
        const client = createRetryingClient(bodies);
        const processPayload: CreateProcessRunPayload = { process_id: 'process-1', run_type: 'programmatic' };

        await client.agents.start(processPayload);
        expect(bodies).toHaveLength(2);
    });
});
