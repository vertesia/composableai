import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const tsc = join(dirname(createRequire(import.meta.url).resolve('typescript/package.json')), 'bin', 'tsc');
const tsconfig = fileURLToPath(new URL('../../tsconfig.json', import.meta.url));

/** Emits the package's declarations with its own build configuration and returns `registry.d.ts`. */
function emitRegistryDeclaration(): string {
    const dir = mkdtempSync(join(tmpdir(), 'registry-dts-'));
    try {
        execFileSync(process.execPath, [
            tsc,
            '-p',
            tsconfig,
            '--emitDeclarationOnly',
            '--declarationMap',
            'false',
            '--outDir',
            join(dir, 'out'),
            '--tsBuildInfoFile',
            join(dir, 'tsbuildinfo'),
        ]);
        return readFileSync(join(dir, 'out', 'api-schemas', 'registry.d.ts'), 'utf8');
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

/**
 * The registry groups' inferred types re-print every schema they register. They stay out of the published
 * declarations only while no exported declaration depends on a group, which nothing but declaration emit shows.
 */
describe('registry declarations', () => {
    it('do not carry the schema groups', { timeout: 120_000 }, () => {
        expect(
            emitRegistryDeclaration(),
            'registry.d.ts names a schema group: derive exported types from the generated ApiComponentTypes map',
        ).not.toMatch(/_SCHEMAS\b|API_SCHEMA_GROUPS/);
    });
});
