import { test as base, expect } from '@playwright/test';
import { VertesiaClient } from '@vertesia/client';

type VertesiaFixtures = {
    vertesiaAuth: undefined;
    /** Version-aware root client for candidate-only Store and runtime checks. */
    vertesiaClient: VertesiaClient;
};

function acceptsVertesiaAuth(value: string): boolean {
    try {
        const host = new URL(value).hostname.toLowerCase();
        return (
            host === 'localhost' ||
            host === '127.0.0.1' ||
            host === '::1' ||
            host === 'vertesia.io' ||
            host.endsWith('.vertesia.io')
        );
    } catch {
        return false;
    }
}

/**
 * Generated-app Playwright tests import `test` and `expect` from this module. When the workflow
 * supplies VERTESIA_TOKEN, the fixture installs it before navigation and attaches it only to
 * localhost/Vertesia requests. This survives reloads without depending on Central Auth redirects.
 */
export const test = base.extend<VertesiaFixtures>({
    vertesiaAuth: [
        async ({ context }, use) => {
            const token = process.env.VERTESIA_TOKEN;
            if (token) {
                await context.addInitScript((value) => {
                    Object.defineProperty(window, '__VERTESIA_AUTH_TOKEN__', {
                        value,
                        configurable: false,
                        enumerable: false,
                        writable: false,
                    });
                }, token);
                await context.route('**/*', async (route) => {
                    const headers = { ...route.request().headers() };
                    if (acceptsVertesiaAuth(route.request().url())) headers.authorization = `Bearer ${token}`;
                    else delete headers.authorization;
                    await route.continue({ headers });
                });
            }
            await use(undefined);
        },
        { auto: true },
    ],
    vertesiaClient: async (_fixtures, use) => {
        const token = process.env.VERTESIA_TOKEN;
        if (!token) throw new Error('vertesiaClient requires VERTESIA_TOKEN');

        const studio = process.env.VERTESIA_SERVER_URL;
        const store = process.env.VERTESIA_STORE_URL;
        const endpoints = studio && store ? { studio, store } : undefined;
        const client = await VertesiaClient.fromAuthToken(token, undefined, endpoints);
        const version = process.env.PLAYWRIGHT_APP_VERSION ?? process.env.VITE_APP_VERSION;
        if (version) client.withAppVersion(version);
        await use(client);
    },
});

export { expect };
