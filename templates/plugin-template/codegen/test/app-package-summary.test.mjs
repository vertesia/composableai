import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { GET } from '../../api/oauth-client.ts';
import { appOAuthPermissions, appOAuthScopes } from '../../src/app-permissions.ts';
import { summarizeAppPackage } from '../../src/modules/service/scripts/app-package-summary.mjs';

test('summarizes lifecycle and event hooks by registered name', () => {
    const summary = summarizeAppPackage({
        hooks: {
            install: '/api/hooks/install',
            uninstall: '/api/hooks/uninstall',
            events: [
                { name: 'document-created', path: '/api/hooks/document-created' },
                { name: 'content-updated', path: '/api/hooks/content-updated' },
            ],
        },
        subscriptions: [{ id: 'document-created' }],
    });

    assert.deepEqual(summary.hooks, ['content-updated', 'document-created', 'install', 'uninstall']);
    assert.deepEqual(summary.subscriptions, ['document-created']);
});

test('publishes declared OAuth scopes in the build summary', () => {
    assert.deepEqual(summarizeAppPackage({ oauth_scopes: ['openid', 'content:read'] }).oauth_scopes, [
        'openid',
        'content:read',
    ]);
    assert.deepEqual(summarizeAppPackage({}).oauth_scopes, []);
});

test('publishes the immutable settings schema used by advanced launches', () => {
    const settingsSchema = {
        type: 'object',
        properties: { region: { type: 'string' } },
        required: ['region'],
    };

    assert.deepEqual(summarizeAppPackage({ settings_schema: settingsSchema }).settings_schema, settingsSchema);
    assert.equal('settings_schema' in summarizeAppPackage({}), false);
});

test('publishes AppGen template provenance and versioned runtime features', () => {
    const metadata = {
        name: 'plugin-template',
        version: 1,
        runtime_features: { advanced_launch: 1 },
    };

    assert.deepEqual(summarizeAppPackage({}, { 'vertesia-appgen': metadata }).appgen_template, metadata);
    assert.equal('appgen_template' in summarizeAppPackage({}), false);
});

test('rejects malformed declared AppGen template metadata', () => {
    assert.throws(
        () =>
            summarizeAppPackage(
                {},
                {
                    'vertesia-appgen': {
                        name: 'plugin-template',
                        version: 1,
                        runtime_features: { 'Advanced Launch': 1 },
                    },
                },
            ),
        /invalid feature/,
    );
    assert.throws(
        () =>
            summarizeAppPackage(
                {},
                {
                    'vertesia-appgen': {
                        name: 'plugin-template',
                        version: 1,
                        runtime_features: { advanced_launch: 0 },
                    },
                },
            ),
        /must be a positive integer/,
    );
});

test('standalone metadata uses the shared permissions and declares session renewal', async () => {
    const previous = process.env.APP_OAUTH_SCOPES;
    delete process.env.APP_OAUTH_SCOPES;
    try {
        const response = GET(new Request('https://app.example.test/.well-known/oauth-client/vertesia-app'));
        const metadata = await response.json();
        assert.equal(metadata.scope, appOAuthScopes.join(' '));
        assert.ok(metadata.grant_types.includes('refresh_token'));
        process.env.APP_OAUTH_SCOPES = 'openid profile content:read';
        const narrowed = await GET(new Request('https://app.example.test/')).json();
        assert.equal(narrowed.scope, 'openid profile content:read');
        assert.deepEqual(narrowed.grant_types, ['authorization_code']);
    } finally {
        if (previous === undefined) delete process.env.APP_OAUTH_SCOPES;
        else process.env.APP_OAUTH_SCOPES = previous;
    }
});

test('browser session renewal follows the effective app OAuth permissions', () => {
    assert.deepEqual(appOAuthPermissions(), { scopes: appOAuthScopes, offlineAccess: true });
    assert.deepEqual(appOAuthPermissions('openid profile content:read'), {
        scopes: ['openid', 'profile', 'content:read'],
        offlineAccess: false,
    });
    assert.deepEqual(appOAuthPermissions('  openid\t offline_access  '), {
        scopes: ['openid', 'offline_access'],
        offlineAccess: true,
    });
    assert.deepEqual(appOAuthPermissions(''), { scopes: [], offlineAccess: false });
});

test('packaged metadata handler runs without its original TypeScript dependency', async () => {
    const root = mkdtempSync(join(tmpdir(), 'template-oauth-'));
    try {
        const outfile = join(root, 'oauth-client.mjs');
        await build({
            entryPoints: [new URL('../../api/oauth-client.ts', import.meta.url).pathname],
            bundle: true,
            platform: 'node',
            format: 'esm',
            outfile,
        });
        const packaged = await import(pathToFileURL(outfile).href);
        const clientId = 'https://preview-app.vercel.app/.well-known/oauth-client/vertesia-app';
        const response = packaged.GET(new Request(clientId));
        assert.equal(response.status, 200);
        const metadata = await response.json();
        assert.equal(metadata.client_id, clientId);
        assert.deepEqual(metadata.redirect_uris, ['https://preview-app.vercel.app/app']);
        assert.equal(metadata.token_endpoint_auth_method, 'none');
        assert.equal(metadata.scope, appOAuthScopes.join(' '));
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
