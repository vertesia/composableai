import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { adjustPackageJson } from '../lib/process-template.js';

test('adjustPackageJson propagates package adjustment failures', () => {
    const projectPath = mkdtempSync(join(tmpdir(), 'create-plugin-adjust-'));
    try {
        writeFileSync(join(projectPath, 'package.json'), '{ invalid json');
        assert.throws(
            () => adjustPackageJson(projectPath, { PROJECT_NAME: 'broken-app' }, false, 'pnpm', 'pinned'),
            SyntaxError,
        );
    } finally {
        rmSync(projectPath, { recursive: true, force: true });
    }
});
