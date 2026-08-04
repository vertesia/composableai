import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { appgenDocsRoot } from '../lib/index.js';

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
