import { describe, expect, it, vi } from 'vitest';
import { ZenoClient } from './client.js';

describe('ObjectsApi revision labels', () => {
    it.each(['v1.2', 'Review — 日本語', 'Révision – café', '100% complete & reviewed + approved'])(
        'preserves the revision label %s through the query contract',
        async (revisionLabel) => {
            const requests: Request[] = [];
            const client = new ZenoClient({
                serverUrl: 'https://api.example.com',
                fetch: vi.fn(async () => Response.json({ id: 'document-id' })),
                onRequest: (request) => requests.push(request),
            });

            await client.objects.update(
                'document-id',
                { name: 'Updated document' },
                {
                    createRevision: true,
                    revisionLabel,
                    ifMatch: 'previous-etag',
                },
            );

            expect(requests).toHaveLength(1);
            const request = requests[0];
            expect(request.method).toBe('PUT');
            expect(new URL(request.url).searchParams.get('revision_label')).toBe(revisionLabel);
            expect(request.headers.has('x-revision-label')).toBe(false);
            expect(request.headers.get('x-create-revision')).toBe('true');
            expect(request.headers.get('if-match')).toBe('previous-etag');
            expect(await request.clone().json()).toEqual({ name: 'Updated document' });
        },
    );

    it('does not send a label when updating in place', async () => {
        const requests: Request[] = [];
        const client = new ZenoClient({
            serverUrl: 'https://api.example.com',
            fetch: vi.fn(async () => Response.json({ id: 'document-id' })),
            onRequest: (request) => requests.push(request),
        });

        await client.objects.update('document-id', {}, { revisionLabel: 'Unused — label' });

        expect(new URL(requests[0].url).searchParams.has('revision_label')).toBe(false);
        expect(requests[0].headers.has('x-create-revision')).toBe(false);
        expect(requests[0].headers.has('x-revision-label')).toBe(false);
    });
});

describe('ObjectsApi.create idempotency keys', () => {
    /** Fails the first attempt with a retryable 503 and records the body of every attempt. */
    function createRetryingClient(bodies: string[], idempotencyKeys: boolean) {
        let attempt = 0;
        return new ZenoClient({
            serverUrl: 'https://zeno.example.com',
            retryPolicy: { attempts: 3, methods: ['POST'], baseDelayMs: 0, jitter: false, idempotencyKeys },
            fetch: vi.fn(async (input: unknown) => {
                bodies.push(input instanceof Request ? await input.text() : '');
                attempt++;
                return attempt === 1
                    ? new Response('unavailable', { status: 503 })
                    : Response.json({ id: 'document-id' }, { status: 200 });
            }),
        });
    }

    it('sends one generated key on every attempt when the policy asks for idempotency keys', async () => {
        const bodies: string[] = [];
        await createRetryingClient(bodies, true).objects.create({ name: 'keyed' });

        expect(bodies).toHaveLength(2);
        expect(bodies[1]).toBe(bodies[0]);
        expect(JSON.parse(bodies[0] ?? '{}').idempotency_key).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('keeps a caller key, and sends none without the opt-in', async () => {
        const keyed: string[] = [];
        await createRetryingClient(keyed, true).objects.create({ name: 'keyed', idempotency_key: 'key-1' });
        const plain: string[] = [];
        await createRetryingClient(plain, false).objects.create({ name: 'plain' });

        expect(JSON.parse(keyed[0] ?? '{}')).toMatchObject({ idempotency_key: 'key-1' });
        expect(JSON.parse(plain[0] ?? '{}')).not.toHaveProperty('idempotency_key');
    });
});
