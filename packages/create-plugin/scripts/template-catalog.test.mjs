import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// These catalogs contain flat, quoted string values. Reject other YAML shapes
// so a config change cannot silently escape the synchronization check.
function readCatalog(relativePath) {
    const lines = readFileSync(new URL(relativePath, import.meta.url), 'utf8').split('\n');
    const start = lines.indexOf('catalog:');
    assert.notEqual(start, -1, `${relativePath} must declare a catalog`);
    const catalog = {};
    for (const line of lines.slice(start + 1)) {
        if (!line.trim() || line.trimStart().startsWith('#')) continue;
        if (!line.startsWith(' ')) break;
        const entry = line.match(/^ {2}(?:("[^"]+")|([^\s:]+)): ("[^"]+")\s*$/);
        assert.ok(entry, `Unsupported catalog entry in ${relativePath}: ${line}`);
        const name = entry[1] ? JSON.parse(entry[1]) : entry[2];
        catalog[name] = JSON.parse(entry[3]);
    }
    assert.ok(Object.keys(catalog).length, `${relativePath} must contain catalog entries`);
    return catalog;
}

test('plugin template catalog stays synchronized with the workspace', () => {
    const workspace = readCatalog('../../../pnpm-workspace.yaml');
    const template = readCatalog('../../../templates/plugin-template/pnpm-workspace.yaml.template');
    for (const [name, version] of Object.entries(template)) {
        assert.equal(
            version,
            workspace[name],
            `Template catalog ${name} drifted; update pnpm-workspace.yaml.template with the workspace catalog`,
        );
    }
    const builder = JSON.parse(readFileSync(new URL('../../plugin-builder/package.json', import.meta.url), 'utf8'));
    assert.equal(
        builder.peerDependencies.vite,
        'catalog:',
        'Resolve the plugin-builder Vite peer from the shared catalog',
    );
    assert.ok(template.vite, 'The generated plugin must pin the plugin-builder Vite peer');
});
