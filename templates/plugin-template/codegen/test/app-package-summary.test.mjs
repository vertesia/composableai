import assert from 'node:assert/strict';
import test from 'node:test';
import { GET } from '../../api/oauth-client.js';
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
