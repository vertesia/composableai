import assert from 'node:assert/strict';
import test from 'node:test';
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
