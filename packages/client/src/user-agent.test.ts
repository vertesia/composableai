import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { VertesiaClient } from './client.js';
import { clientUserAgentHeaders } from './user-agent.js';

const packageVersion = (
    JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
).version;

describe('client User-Agent', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('Studio and Store requests identify the SDK, its version and the runtime', () => {
        const client = new VertesiaClient({
            serverUrl: 'https://api.vertesia.io',
            storeUrl: 'https://api.vertesia.io',
        });
        const expected = `vertesia-client-ts/${packageVersion} node/${process.versions.node}`;

        expect(client.headers['user-agent']).toBe(expected);
        expect(client.store.headers['user-agent']).toBe(expected);
    });

    test('is not set in a browser', () => {
        vi.stubGlobal('window', {});

        expect(clientUserAgentHeaders()).toEqual({});
    });
});
