import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetDuplicateRequestReports } from './duplicateRequests';
import { UserSession } from './UserSession';

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('@vertesia/ui/env', () => ({
    Env: {
        logger: { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
        endpoints: {
            studio: 'https://studio.example.test',
            zeno: 'https://store.example.test',
            sts: 'https://sts.example.test',
        },
    },
}));

describe('UserSession in-flight deduplication', () => {
    afterEach(() => {
        resetDuplicateRequestReports();
        vi.unstubAllGlobals();
        warn.mockClear();
    });

    it('shares identical in-flight GETs and logs the duplicate', async () => {
        const fetchMock = vi.fn(
            async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
        );
        vi.stubGlobal('fetch', fetchMock);
        const session = new UserSession();
        expect(session.client.getInFlightRequests()).toBeDefined();

        await Promise.all([session.client.projects.retrieve('p1'), session.client.projects.retrieve('p1')]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(expect.any(String), {
            duplicate_request: expect.objectContaining({
                path: 'https://studio.example.test/api/v1/projects/p1',
                shared: true,
            }),
        });
    });
});
