import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const envEntry = new URL('../../src/ui/env.ts', import.meta.url);

async function bootstrap({
    origin = 'https://localhost:5173',
    clientId,
    devAuthToken,
    prod = false,
    hostToken,
    authMode,
    embedded = false,
    gatewaySession = false,
} = {}) {
    const location = new URL(origin);
    const fixture = {
        env: {
            init(props) {
                Object.assign(this, props);
                return this;
            },
        },
        window: { location, AUTH_MODE: authMode },
        document: {},
    };
    fixture.window.parent = embedded ? {} : fixture.window;
    fixture.window.__VERTESIA_RUNTIME_CONFIG__ = { authMode: 'central', gatewaySession };
    const result = await build({
        entryPoints: [envEntry.pathname],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'browser',
        define: {
            'import.meta.env': JSON.stringify({
                PROD: prod,
                DEV: !prod,
                VITE_OAUTH_CLIENT_ID: clientId,
                VITE_VERTESIA_AUTH_TOKEN: devAuthToken,
                VITE_VERTESIA_STUDIO_URL: 'https://api.dev1.vertesia.io',
                VITE_VERTESIA_ZENO_URL: 'https://api.dev1.vertesia.io',
                VITE_VERTESIA_STS_URL: 'https://sts.dev1.vertesia.io',
            }),
        },
        plugins: [
            {
                name: 'auth-fixture',
                setup(build) {
                    build.onResolve({ filter: /^(virtual:vertesia-branding|@vertesia\/ui\/(env|shell))$/ }, (args) => ({
                        path: args.path,
                        namespace: 'fixture',
                    }));
                    build.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
                        contents:
                            args.path === 'virtual:vertesia-branding'
                                ? 'export default { name: "Test app" };'
                                : args.path.endsWith('/shell')
                                  ? 'export async function requestIframeHostAuthToken() { return globalThis.fixture.hostToken; }'
                                  : `export const Env = globalThis.fixture.env;
                                     export function normalizeHostname(host) {
                                         return host.toLowerCase().replace(/\\.$/, '');
                                     }
                                     export function isLoopbackHostname(host) {
                                         return host === 'localhost' || host.endsWith('.localhost') ||
                                             host === '127.0.0.1' || host === '[::1]';
                                     }`,
                    }));
                },
            },
        ],
    });
    const original = { window: globalThis.window, document: globalThis.document, fixture: globalThis.fixture };
    Object.assign(globalThis, {
        window: fixture.window,
        document: fixture.document,
        fixture: { ...fixture, hostToken },
    });
    try {
        // Unique URL ensures each fixture initializes the real template module anew.
        const source = `${result.outputFiles[0].text}\n// ${crypto.randomUUID()}`;
        const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
        return {
            env: fixture.env,
            validate() {
                globalThis.window = fixture.window;
                try {
                    module.validateLocalAuthConfiguration();
                } finally {
                    Object.assign(globalThis, original);
                }
            },
            async token() {
                Object.assign(globalThis, {
                    window: fixture.window,
                    fixture: { ...fixture, hostToken },
                });
                try {
                    return await fixture.env.authTokenProvider();
                } finally {
                    Object.assign(globalThis, original);
                }
            },
        };
    } finally {
        Object.assign(globalThis, original);
    }
}

for (const origin of ['http://localhost:5173', 'https://localhost:5173']) {
    test(`${origin} requires a registered client even for built apps`, async () => {
        const app = await bootstrap({ origin, prod: true });
        assert.equal(app.env.oauth, undefined);
        assert.throws(() => app.validate(), /Set VITE_OAUTH_CLIENT_ID.*build environment variables.*rebuild/);
    });
    test(`${origin} uses an explicitly configured development client`, async () => {
        const app = await bootstrap({ origin, clientId: '  my-app-development  ' });
        assert.equal(app.env.oauth.clientId, 'my-app-development');
        assert.equal(app.env.oauth.redirectUri, `${origin}/`);
        assert.doesNotThrow(() => app.validate());
    });
}

for (const prod of [false, true]) {
    test(`trailing-dot localhost requires a registered client (prod=${prod})`, async () => {
        const app = await bootstrap({ origin: 'https://localhost.:5173', prod });
        assert.equal(app.env.oauth, undefined);
        assert.throws(() => app.validate(), /Set VITE_OAUTH_CLIENT_ID/);
    });
}

test('development setup guidance explains how to restart with local configuration', async () => {
    const app = await bootstrap();
    assert.throws(() => app.validate(), /Update .env.app.local, then restart the dev server/);
});

test('local development tokens retain precedence and are excluded from production', async () => {
    const app = await bootstrap({ devAuthToken: 'development-token' });
    assert.equal(app.env.devAuthToken, 'development-token');
    assert.doesNotThrow(() => app.validate());
    const builtApp = await bootstrap({ devAuthToken: 'development-token', prod: true });
    assert.equal(builtApp.env.devAuthToken, undefined);
    assert.throws(() => builtApp.validate(), /Set VITE_OAUTH_CLIENT_ID/);
});

test('independent HTTPS deployments default to CIMD and accept a named client override', async () => {
    const origin = 'https://my-app.vercel.app';
    const metadataApp = await bootstrap({ origin, prod: true });
    assert.equal(metadataApp.env.oauth.clientId, `${origin}/.well-known/oauth-client/vertesia-app`);
    assert.equal(metadataApp.env.oauth.redirectUri, `${origin}/app`);
    const registeredApp = await bootstrap({ origin, prod: true, clientId: 'my-app-production' });
    assert.equal(registeredApp.env.oauth.clientId, 'my-app-production');
    assert.equal(registeredApp.env.oauth.redirectUri, `${origin}/app`);
});

test('local embedded apps retain a host-provided token', async () => {
    const app = await bootstrap({ hostToken: 'host-token', embedded: true });
    assert.doesNotThrow(() => app.validate());
    assert.equal(await app.token(), 'host-token');
});

test('explicit Firebase authentication retains the local provider flow', async () => {
    const app = await bootstrap({ authMode: 'firebase' });
    assert.doesNotThrow(() => app.validate());
});

test('local gateway sessions do not require a separately configured client', async () => {
    const app = await bootstrap({ gatewaySession: true });
    assert.doesNotThrow(() => app.validate());
});
