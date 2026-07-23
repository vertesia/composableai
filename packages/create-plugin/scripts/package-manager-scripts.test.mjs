import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { normalizePackageManagerScripts } from '../lib/process-template.js';

function testProject(scripts) {
    const root = mkdtempSync(join(tmpdir(), 'create-plugin-package-manager-'));
    writeFileSync(join(root, 'package.json'), `${JSON.stringify({ scripts }, null, 4)}\n`);
    return root;
}

function readScripts(root) {
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts;
}

test('normalizes npm and pnpm script invocations to npm', () => {
    const root = testProject({
        build: 'pnpm run build:ui && npm run build:server',
        pretest: 'pnpm test:codegen',
        'test:codegen': 'node --test codegen/test/*.test.mjs',
        lint: 'biome check src',
        documentation: 'echo "Use pnpm test:codegen locally"',
    });
    try {
        assert.equal(normalizePackageManagerScripts(root, 'npm'), 2);
        assert.deepEqual(readScripts(root), {
            build: 'npm run build:ui && npm run build:server',
            pretest: 'npm run test:codegen',
            'test:codegen': 'node --test codegen/test/*.test.mjs',
            lint: 'biome check src',
            documentation: 'echo "Use pnpm test:codegen locally"',
        });
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('normalizes npm and pnpm script invocations to pnpm', () => {
    const root = testProject({
        build: 'npm run build:ui && pnpm run build:server',
        pretest: 'npm test:codegen',
        'test:codegen': 'node --test codegen/test/*.test.mjs',
        lint: 'biome check src',
        documentation: 'echo "Use npm test:codegen locally"',
    });
    try {
        assert.equal(normalizePackageManagerScripts(root, 'pnpm'), 2);
        assert.deepEqual(readScripts(root), {
            build: 'pnpm run build:ui && pnpm run build:server',
            pretest: 'pnpm run test:codegen',
            'test:codegen': 'node --test codegen/test/*.test.mjs',
            lint: 'biome check src',
            documentation: 'echo "Use npm test:codegen locally"',
        });
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
