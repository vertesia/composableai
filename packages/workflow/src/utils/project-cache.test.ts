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

    it('gives each caller its own copy', async () => {
        const { client } = mockClient(async (id) => project(id));

        const first = await fetchCachedProject(client, 'p1');
        first.configuration.human_context = 'mutated';
        const second = await fetchCachedProject(client, 'p1');

        expect(second.configuration.human_context).toBe('v1');
    });
});
