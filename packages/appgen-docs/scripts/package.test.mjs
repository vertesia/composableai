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
    'symbol-index.json',
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
    assert.match(uiRecipe, /this recipe is complete/);
    assert.match(uiRecipe, /let the first workspace typecheck/);
    assert.match(uiRecipe, /using `import type` makes JSX fail with TS1361/);
    assert.match(uiRecipe, /native `<section aria-label="…">`/);
    assert.match(uiRecipe, /lint\/a11y\/useSemanticElements/);
    assert.match(uiRecipe, /Vitest in a Node environment/);
    assert.match(uiRecipe, /separate production `\*\.state\.ts` or `\*\.model\.ts` module/);
    assert.match(uiRecipe, /Do not export the helper only from the component's TSX module/);
    assert.match(uiRecipe, /the tested module must remain on the production import path/);
    assert.match(uiRecipe, /path containing `\/interactions`/);
    assert.match(uiRecipe, /import `type \{ Page \}` from `@playwright\/test`/);
    assert.match(uiRecipe, /never hand-write a structural Page or Route type/);
    assert.match(uiRecipe, /getByRole\('cell', \{ name: interactionName, exact: true \}\)/);
    assert.match(uiRecipe, /Assert positive horizontal overflow only at the narrow viewport/);
    assert.match(uiRecipe, /toBeInViewport\(\)/);

    const clientRecipe = await readFile(join(appgenDocsRoot, 'recipes', 'client-interactions.md'), 'utf8');
    assert.match(clientRecipe, /client\.interactions\.list\(\)/);
    assert.match(clientRecipe, /Promise<InteractionRef\[\]>/);
    assert.match(clientRecipe, /InteractionRef` deliberately has no `type` field/);
    assert.match(clientRecipe, /client\.interactions\.catalog\.listStoredInteractions\(\)/);
    assert.match(clientRecipe, /Promise<CatalogInteractionRef\[\]>/);
    assert.match(clientRecipe, /GET \/api\/v1\/interactions\/catalog\/stored/);
    assert.match(clientRecipe, /bare `CatalogInteractionRef\[\]` array/);
    assert.match(clientRecipe, /Do not probe the live API/);
    assert.match(clientRecipe, /combined system, app, and stored catalog/);

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

    const symbolIndex = JSON.parse(await readFile(join(appgenDocsRoot, 'symbol-index.json'), 'utf8'));
    assert.equal(symbolIndex.format_version, 1);
    assert.match(symbolIndex.index_version, /^[a-f0-9]{64}$/);
    assert.ok(symbolIndex.symbols.length > 100);
    const useFetchCard = symbolIndex.symbols.find(
        (card) => card.symbol === 'useFetch' && card.import_from === '@vertesia/ui/core',
    );
    assert.equal(useFetchCard.import_kind, 'value');
    assert.equal(useFetchCard.import_example, "import { useFetch } from '@vertesia/ui/core';");
    assert.equal(useFetchCard.source_path, 'core/hooks/useFetch.d.ts');
    assert.match(useFetchCard.source_sha256, /^[a-f0-9]{64}$/);

    const textRebaseResultCard = symbolIndex.symbols.find(
        (card) => card.symbol === 'TextRebaseResult' && card.import_from === '@vertesia/ui/widgets',
    );
    assert.match(textRebaseResultCard.signature, /status: 'conflict'/);

    const interactionRefCard = symbolIndex.symbols.find(
        (card) => card.symbol === 'InteractionRef' && card.import_from === '@vertesia/common',
    );
    assert.equal(interactionRefCard.import_kind, 'type');
    assert.equal(interactionRefCard.import_example, "import type { InteractionRef } from '@vertesia/common';");
});
