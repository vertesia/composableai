import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { appgenDocsRoot } from '../lib/index.js';

const expectedDocs = [
    'app-package-patterns.md',
    'frontend-imports.md',
    'handlebars-prompts.md',
    'interaction-runtime.md',
    'package-dashboards.md',
    'package-processes.md',
    'package-types.md',
    'recipes/client-interactions.md',
    'recipes/ui-components.md',
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

    const uiRecipe = await readFile(join(appgenDocsRoot, 'recipes', 'ui-components.md'), 'utf8');
    assert.match(uiRecipe, /<TBody columns=\{2\} isLoading=\{isLoading\}>/);
    assert.match(uiRecipe, /TableHeaderCell/);
    assert.match(uiRecipe, /Vitest in a Node environment/);
    assert.match(uiRecipe, /small pure view-state or data helper/);
    assert.match(uiRecipe, /path containing `\/interactions`/);

    const clientRecipe = await readFile(join(appgenDocsRoot, 'recipes', 'client-interactions.md'), 'utf8');
    assert.match(clientRecipe, /client\.interactions\.list\(\)/);
    assert.match(clientRecipe, /Promise<InteractionRef\[\]>/);

    const storeObjects = await readFile(join(appgenDocsRoot, 'store-objects.md'), 'utf8');
    assert.match(storeObjects, /Every `objects\.create` payload requires a top-level `name`/);
    assert.match(storeObjects, /name: record\.title/);

    const interactionRuntime = await readFile(join(appgenDocsRoot, 'interaction-runtime.md'), 'utf8');
    assert.match(interactionRuntime, /executeByName<StatusBriefingResult, StatusBriefingInput>/);
    assert.match(interactionRuntime, /execution\.result\.object\(\)/);
    assert.match(interactionRuntime, /root SDK has no `client\.activities` execution API/);
    assert.match(interactionRuntime, /client\.agents\.start/);
    assert.match(interactionRuntime, /client\.agents\.streamMessages/);
    assert.match(interactionRuntime, /client\.agents\.retrieveProcess/);
    assert.match(interactionRuntime, /Never invent `client\.activities\.executeByName`/);
});
