import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { appgenDocsRoot } from '../lib/index.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(SCRIPT_DIR, '..');
const REPO_ROOT = join(PACKAGE_ROOT, '..', '..');
const canonicalToolServerReference = join(PACKAGE_ROOT, 'references', 'tool-server-resource.md');
const templateToolServerReference = join(
    REPO_ROOT,
    'templates',
    'plugin-template',
    '.agents',
    'skills',
    'vertesia-tool-server-resource',
    'REFERENCE.md',
);

const expectedDocs = [
    'app-package-patterns.md',
    'frontend-imports.md',
    'handlebars-prompts.md',
    'package-dashboards.md',
    'package-processes.md',
    'package-types.md',
    'store-objects.md',
    'tool-server-resource.md',
    'ui-interfaces.d.ts',
    'ui/llms.txt',
    'vertesia-client.d.ts',
    'vertesia-common.d.ts',
];

test('ships the generated app-development references', async () => {
    await Promise.all(expectedDocs.map((path) => access(join(appgenDocsRoot, path))));

    const frontendImports = await readFile(join(appgenDocsRoot, 'frontend-imports.md'), 'utf8');
    assert.match(frontendImports, /## Runtime CDN Imports/);
    assert.match(frontendImports, /documentation synchronizer replaces this section/);
});

test('keeps the scaffold tool-server reference synchronized with the canonical package source', async () => {
    const [canonical, template] = await Promise.all([
        readFile(canonicalToolServerReference, 'utf8'),
        readFile(templateToolServerReference, 'utf8'),
    ]);

    assert.equal(template, canonical);
});
