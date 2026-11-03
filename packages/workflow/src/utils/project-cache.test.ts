import type { VertesiaClient } from '@vertesia/client';
import type { Project } from '@vertesia/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearProjectCache, fetchCachedProject, PROJECT_CACHE_TTL_MS } from './project-cache.js';

function project(id: string, humanContext = 'v1'): Project {
    return { id, name: `Project ${id}`, configuration: { human_context: humanContext } } as unknown as Project;
}

function mockClient(retrieve: (id: string) => Promise<Project>) {
    const fn = vi.fn(retrieve);
    return { client: { projects: { retrieve: fn } } as unknown as VertesiaClient, retrieve: fn };
}

describe('fetchCachedProject', () => {
    beforeEach(() => {
        clearProjectCache();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('serves a cached project within the TTL', async () => {
        const { client, retrieve } = mockClient(async (id) => project(id));

        const first = await fetchCachedProject(client, 'p1');
        vi.advanceTimersByTime(PROJECT_CACHE_TTL_MS - 1);
        const second = await fetchCachedProject(client, 'p1');

        expect(retrieve).toHaveBeenCalledTimes(1);
        expect(second).toEqual(first);
    });

    it('keys the cache by project ID', async () => {
        const { client, retrieve } = mockClient(async (id) => project(id));

        await fetchCachedProject(client, 'p1');
        const other = await fetchCachedProject(client, 'p2');

        expect(retrieve).toHaveBeenCalledTimes(2);
        expect(other.id).toBe('p2');
    });

    it('fetches again once the TTL has expired', async () => {
        let version = 1;
        const { client, retrieve } = mockClient(async (id) => project(id, `v${version}`));

        await fetchCachedProject(client, 'p1');
        version = 2;
        vi.advanceTimersByTime(PROJECT_CACHE_TTL_MS);
        const refreshed = await fetchCachedProject(client, 'p1');

        expect(retrieve).toHaveBeenCalledTimes(2);
        expect(refreshed.configuration.human_context).toBe('v2');
    });

    it('shares one fetch between concurrent misses', async () => {
        let resolve!: (p: Project) => void;
        const { client, retrieve } = mockClient(
            () =>
                new Promise<Project>((r) => {
                    resolve = r;
                }),
        );

        const pending = [fetchCachedProject(client, 'p1'), fetchCachedProject(client, 'p1')];
        resolve(project('p1'));
        const results = await Promise.all(pending);

        expect(retrieve).toHaveBeenCalledTimes(1);
        expect(results[0]).toEqual(results[1]);
    });

    it('rejects every waiting caller on a failed fetch and does not cache the failure', async () => {
        let reject!: (err: Error) => void;
        const { client, retrieve } = mockClient(
            () =>
                new Promise<Project>((_, r) => {
                    reject = r;
                }),
        );

        const pending = [fetchCachedProject(client, 'p1'), fetchCachedProject(client, 'p1')];
        const error = new Error('studio unavailable');
        reject(error);
        await expect(pending[0]).rejects.toBe(error);
        await expect(pending[1]).rejects.toBe(error);

        retrieve.mockResolvedValueOnce(project('p1'));
        const recovered = await fetchCachedProject(client, 'p1');

        expect(retrieve).toHaveBeenCalledTimes(2);
        expect(recovered.id).toBe('p1');
    });

    describe('with cancellable callers', () => {
        /** A client that, like an activity's client, aborts its requests when its activity is cancelled. */
        function cancellableClient(signal: AbortSignal) {
            const pending: Array<(p: Project) => void> = [];
            const { client, retrieve } = mockClient(
                (id) =>
                    new Promise<Project>((resolve, reject) => {
                        signal.addEventListener('abort', () => reject(new Error(`request for ${id} aborted`)), {
                            once: true,
                        });
                        pending.push(resolve);
                    }),
            );
            const resolveAll = (p: Project) => {
                for (const resolve of pending.splice(0)) {
                    resolve(p);
                }
            };
            return { client, retrieve, resolveAll };
        }

        it('refetches with its own client when the caller that started the shared fetch is cancelled', async () => {
            const first = new AbortController();
            const second = new AbortController();
            const a = cancellableClient(first.signal);
            const b = cancellableClient(second.signal);

            const firstResult = fetchCachedProject(a.client, 'p1', first.signal);
            const secondResult = fetchCachedProject(b.client, 'p1', second.signal);
            first.abort(new Error('first activity cancelled'));

            await expect(firstResult).rejects.toThrow('request for p1 aborted');
            await vi.waitFor(() => expect(b.retrieve).toHaveBeenCalledTimes(1));
            b.resolveAll(project('p1'));

            await expect(secondResult).resolves.toMatchObject({ id: 'p1' });
            expect(a.retrieve).toHaveBeenCalledTimes(1);
        });

        it("ends only the cancelled caller's wait on a shared fetch", async () => {
            const first = new AbortController();
            const second = new AbortController();
            const a = cancellableClient(first.signal);
            const b = cancellableClient(second.signal);

            const firstResult = fetchCachedProject(a.client, 'p1', first.signal);
            const secondResult = fetchCachedProject(b.client, 'p1', second.signal);
            const reason = new Error('second activity cancelled');
            second.abort(reason);

            await expect(secondResult).rejects.toBe(reason);
            a.resolveAll(project('p1'));
            await expect(firstResult).resolves.toMatchObject({ id: 'p1' });
            expect(b.retrieve).not.toHaveBeenCalled();
        });

        it('still shares a fetch that fails for another reason', async () => {
            const first = new AbortController();
            const second = new AbortController();
            const error = new Error('studio unavailable');
            const a = mockClient(() => Promise.reject(error));
            const b = mockClient(async (id) => project(id));

            const results = [
                fetchCachedProject(a.client, 'p1', first.signal),
                fetchCachedProject(b.client, 'p1', second.signal),
            ];

            await expect(results[0]).rejects.toBe(error);
            await expect(results[1]).rejects.toBe(error);
            expect(b.retrieve).not.toHaveBeenCalled();
        });
    });

    it('gives each caller its own copy', async () => {
        const { client } = mockClient(async (id) => project(id));

        const first = await fetchCachedProject(client, 'p1');
        first.configuration.human_context = 'mutated';
        const second = await fetchCachedProject(client, 'p1');

        expect(second.configuration.human_context).toBe('v1');
    });
});
