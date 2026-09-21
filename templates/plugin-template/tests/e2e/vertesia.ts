import { test as base, expect } from '@playwright/test';
import type { VertesiaClient } from '@vertesia/client';
import { createVertesiaClient } from '../../scripts/vertesia-client.ts';

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
    vertesiaClient: async ({ playwright: _playwright }, use) => {
        // Shared with the app's Node-side seed/exercise scripts so both authenticate and pin the
        // app version exactly one way. See scripts/vertesia-client.ts.
        const client = await createVertesiaClient({
            appVersion: process.env.PLAYWRIGHT_APP_VERSION ?? process.env.VITE_APP_VERSION,
        });
        await use(client);
    },
});

export { expect };
