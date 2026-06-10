/**
 * Tests for `vertesiaDevServerPlugin` — the standalone Vite plugin that
 * transforms Vertesia query-style imports at dev-mode request time.
 *
 * The plugin exposes Vite/Rollup-shaped `resolveId` and `load` hooks. We
 * drive them directly here rather than booting a full Vite dev server,
 * which would add startup cost and fixtures for no extra signal.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vertesiaDevServerPlugin } from '../src/vite/dev-server.js';

type PluginShape = {
    resolveId: (source: string, importer?: string) => string | null;
    load: (id: string) => Promise<string | null | undefined>;
    name: string;
    enforce?: string;
};

// Vite's PluginContext that gets `this`-bound on `load`. We provide a minimal
// stub that re-throws so failures surface as the test's exception.
const pluginContext = {
    error(message: string): never {
        throw new Error(message);
    },
};

function getPlugin(options?: Parameters<typeof vertesiaDevServerPlugin>[0]): PluginShape {
    // The plugin is returned as a Vite Plugin which is structurally compatible
    // with a Rollup plugin. We type-cast through unknown to call the hooks
    // directly without spinning up Vite.
    return vertesiaDevServerPlugin(options) as unknown as PluginShape;
}

async function loadHook(plugin: PluginShape, id: string): Promise<string | null | undefined> {
    return plugin.load.call(pluginContext as never, id);
}

describe('vertesiaDevServerPlugin', () => {
    let workDir: string;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), 'vertesia-dev-server-'));
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
    });

    describe('plugin shape', () => {
        it('returns a plugin with name "vertesia-dev-server" and enforce: "pre"', () => {
            const plugin = getPlugin();
            expect(plugin.name).toBe('vertesia-dev-server');
            expect(plugin.enforce).toBe('pre');
        });
    });

    describe('resolveId', () => {
        it('resolves a relative ?skill import against the importer', () => {
            const plugin = getPlugin();
            const importer = path.join(workDir, 'interactions', 'spec.ts');
            const resolved = plugin.resolveId('./my-skill.md?skill', importer);
            expect(resolved).toBe(path.join(workDir, 'interactions', 'my-skill.md?skill'));
        });

        it('strips the query suffix from the importer when resolving relative paths', () => {
            const plugin = getPlugin();
            // Importer already carries its own query (a nested chunk re-import scenario).
            const importer = path.join(workDir, 'a', 'b.md?skill');
            const resolved = plugin.resolveId('./other.html?raw', importer);
            expect(resolved).toBe(path.join(workDir, 'a', 'other.html?raw'));
        });

        it('returns the source unchanged for a bare SKILL.md match', () => {
            const plugin = getPlugin();
            const resolved = plugin.resolveId('/abs/skills/foo/SKILL.md', undefined);
            expect(resolved).toBe('/abs/skills/foo/SKILL.md');
        });

        it('returns null for imports that no transformer matches', () => {
            const plugin = getPlugin();
            const resolved = plugin.resolveId('./regular.ts', '/foo/bar.ts');
            expect(resolved).toBeNull();
        });

        it('only activates the configured subset of transformers when `transformers` is set', () => {
            const plugin = getPlugin({ transformers: ['raw'] });
            // skill marker is in the source but only `raw` is active → no match
            expect(plugin.resolveId('./x.md?skill', '/foo/bar.ts')).toBeNull();
            // raw matches
            expect(plugin.resolveId('./x.html?raw', '/foo/bar.ts')).toBe('/foo/x.html?raw');
        });
    });

    describe('load', () => {
        it('transforms a ?raw import into a default-exported string module', async () => {
            writeFileSync(join(workDir, 'doc.html'), '<p>hello</p>', 'utf-8');
            const plugin = getPlugin();
            const code = await loadHook(plugin, `${join(workDir, 'doc.html')}?raw`);
            expect(code).toBeDefined();
            expect(code).toContain('export default');
            expect(code).toContain('<p>hello</p>');
        });

        it('transforms a SKILL.md import into a default-exported skill object', async () => {
            const skillDir = join(workDir, 'my-skill');
            mkdirSync(skillDir, { recursive: true });
            writeFileSync(
                join(skillDir, 'SKILL.md'),
                `---\nname: my-skill\ndescription: Test skill body\n---\n# Hello\n`,
                'utf-8',
            );

            const plugin = getPlugin();
            const code = await loadHook(plugin, join(skillDir, 'SKILL.md'));
            expect(code).toBeDefined();
            expect(code).toContain('export default');
            expect(code).toContain('"name": "my-skill"');
        });

        it('returns null for ids that no transformer matches', async () => {
            const plugin = getPlugin();
            const code = await loadHook(plugin, '/abs/just-a-regular.ts');
            expect(code).toBeNull();
        });

        it('throws via plugin context when a transformer fails (e.g. invalid frontmatter)', async () => {
            const skillDir = join(workDir, 'bad-skill');
            mkdirSync(skillDir, { recursive: true });
            writeFileSync(
                join(skillDir, 'SKILL.md'),
                // Missing required `description` → schema validation will fail.
                `---\nname: bad-skill\n---\n# body\n`,
                'utf-8',
            );

            const plugin = getPlugin();
            await expect(loadHook(plugin, join(skillDir, 'SKILL.md'))).rejects.toThrow(
                /vertesia-dev-server: failed to transform/,
            );
        });
    });
});
