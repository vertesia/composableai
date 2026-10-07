import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { replaceVariables } from '../lib/process-template.js';

test('preserves single-quoted template style when replacing code constants', () => {
    const root = mkdtempSync(join(tmpdir(), 'create-plugin-code-values-'));
    const file = join(root, 'config.ts');
    writeFileSync(file, "const CONFIG__PROJECT_NAME = 'plugin-template';\n");

    try {
        replaceVariables(
            root,
            { version: '1.0', files: ['config.ts'], modules: {}, prompts: [] },
            { PROJECT_NAME: "customer's-app" },
        );

        assert.equal(readFileSync(file, 'utf8'), "const CONFIG__PROJECT_NAME = 'customer\\'s-app';\n");
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('serializes permission presets as valid arrays using template quote style', () => {
    const root = mkdtempSync(join(tmpdir(), 'create-plugin-scopes-'));
    const file = join(root, 'permissions.ts');
    writeFileSync(file, "const CONFIG__OAUTH_SCOPES = ['openid'];\n");
    try {
        replaceVariables(
            root,
            { version: '1.0', files: ['permissions.ts'], prompts: [] },
            { OAUTH_SCOPES: ['openid', 'profile', 'offline_access', 'content:read'] },
        );
        assert.equal(
            readFileSync(file, 'utf8'),
            "const CONFIG__OAUTH_SCOPES = ['openid', 'profile', 'offline_access', 'content:read'];\n",
        );
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
