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
