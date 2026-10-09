import { afterEach, describe, expect, it, vi } from 'vitest';

async function importFirebaseAuth() {
    vi.resetModules();
    const [{ Env }, firebaseAuth] = await Promise.all([import('@vertesia/ui/env'), import('./firebase')]);
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    Env.init({
        name: 'test',
        version: '0.0.0',
        isLocalDev: false,
        isDocker: false,
        type: 'test',
        endpoints: { studio: 'https://studio.test', zeno: 'https://zeno.test', sts: 'https://sts.test' },
        firebase: { apiKey: 'key', authDomain: 'auth.test', projectId: 'project' },
        logger,
    });
    return { ...firebaseAuth, logger };
}

describe('setFirebaseTenant', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it.each([
        ['a null answer', () => new Response('null', { status: 200 })],
        ['an older server 404', () => new Response(JSON.stringify({ error: 'Tenant not found' }), { status: 404 })],
    ])('treats %s as an address without a tenant, quietly', async (_label, respond) => {
        const fetchMock = vi.fn(async () => respond());
        vi.stubGlobal('fetch', fetchMock);
        const { setFirebaseTenant, logger } = await importFirebaseAuth();

        await expect(setFirebaseTenant('user@example.com')).resolves.toBeUndefined();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(logger.warn).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
    });
});
