/**
 * Tests for the esbuild-based widget compiler.
 *
 * Inputs are already-compiled JavaScript (mirroring what `tsc` produces from
 * `.tsx` sources). The compiler's job is single-file ESM bundling with
 * React-family packages left external.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { compileWidget, compileWidgets } from '../src/core/compilers/widget.js';

describe('compileWidget', () => {
    let workDir: string;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), 'vertesia-widget-'));
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
    });

    it('bundles a single-entry widget into one ESM file', async () => {
        const entry = join(workDir, 'widget.js');
        writeFileSync(entry, `export default function W() { return 42; }\n`, 'utf-8');

        const out = join(workDir, 'dist');
        const outfile = await compileWidget({ name: 'w', entry }, out);

        expect(outfile).toBe(path.join(out, 'w.js'));
        expect(existsSync(outfile)).toBe(true);
        const bundled = readFileSync(outfile, 'utf-8');
        expect(bundled).toContain('function');
    });

    it('inlines relative imports into the bundle', async () => {
        mkdirSync(join(workDir, 'parts'), { recursive: true });
        writeFileSync(join(workDir, 'parts', 'helper.js'), `export const HELPER_VALUE = 'inlined';\n`, 'utf-8');
        const entry = join(workDir, 'widget.js');
        writeFileSync(
            entry,
            `import { HELPER_VALUE } from './parts/helper.js';\nexport default HELPER_VALUE;\n`,
            'utf-8',
        );

        const outfile = await compileWidget({ name: 'w', entry }, join(workDir, 'dist'));
        const bundled = readFileSync(outfile, 'utf-8');
        expect(bundled).toContain('inlined');
        expect(bundled).not.toContain("from './parts/helper.js'");
    });

    it('leaves React-family imports external by default', async () => {
        const entry = join(workDir, 'widget.js');
        writeFileSync(
            entry,
            `import { jsx } from 'react/jsx-runtime';\nimport React from 'react';\nexport default React;\n`,
            'utf-8',
        );

        const outfile = await compileWidget({ name: 'w', entry }, join(workDir, 'dist'));
        const bundled = readFileSync(outfile, 'utf-8');
        // External imports must remain as ES imports (not inlined).
        expect(bundled).toContain('from "react"');
        expect(bundled).toContain('from "react/jsx-runtime"');
    });

    it('respects a custom externals list', async () => {
        const entry = join(workDir, 'widget.js');
        writeFileSync(entry, `import x from 'preact';\nexport default x;\n`, 'utf-8');

        const outfile = await compileWidget({ name: 'w', entry }, join(workDir, 'dist'), {
            external: ['preact'],
        });
        const bundled = readFileSync(outfile, 'utf-8');
        expect(bundled).toContain('from "preact"');
    });
});

describe('compileWidgets', () => {
    let workDir: string;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), 'vertesia-widgets-'));
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
    });

    it('returns 0 for an empty input list', async () => {
        const count = await compileWidgets([], join(workDir, 'dist'));
        expect(count).toBe(0);
    });

    it('compiles multiple widgets in parallel', async () => {
        const aEntry = join(workDir, 'a.js');
        const bEntry = join(workDir, 'b.js');
        writeFileSync(aEntry, `export default 1;\n`);
        writeFileSync(bEntry, `export default 2;\n`);

        const out = join(workDir, 'dist');
        const count = await compileWidgets(
            [
                { name: 'a', entry: aEntry },
                { name: 'b', entry: bEntry },
            ],
            out,
        );

        expect(count).toBe(2);
        expect(existsSync(join(out, 'a.js'))).toBe(true);
        expect(existsSync(join(out, 'b.js'))).toBe(true);
    });
});
