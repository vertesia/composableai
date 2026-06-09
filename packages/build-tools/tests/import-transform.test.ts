/**
 * End-to-end test for the standalone import-transform pipeline.
 *
 * Sets up a temporary mirror of `src/` and `lib/` (as if `tsc` had just run),
 * invokes `transformImports`, and verifies the resulting chunks, asset
 * copies, widget bundles, and import rewrites.
 */

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { rawTransformer } from '../src/core/transformers/raw.js';
import { skillTransformer } from '../src/core/transformers/skill.js';
import { skillCollectionTransformer } from '../src/core/transformers/skill-collection.js';
import { templateTransformer } from '../src/core/transformers/template.js';
import { templateCollectionTransformer } from '../src/core/transformers/template-collection.js';
import { transformImports } from '../src/import-transform/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURE_ROOT = join(__dirname, 'fixtures');

describe('transformImports — end to end', () => {
    let workDir: string;
    let srcDir: string;
    let libDir: string;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), 'vertesia-build-tools-'));
        srcDir = join(workDir, 'src');
        libDir = join(workDir, 'lib');
        mkdirSync(srcDir, { recursive: true });
        mkdirSync(libDir, { recursive: true });
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
    });

    it('rewrites a SKILL.md import, emits the chunk, copies scripts, and bundles widgets', async () => {
        // Mirror the skill-with-assets fixture into src/
        cpSync(join(FIXTURE_ROOT, 'skill-with-assets'), join(srcDir, 'skill-with-assets'), { recursive: true });

        // Simulate `tsc` having compiled the importer plus the widget .tsx into lib/.
        writeFileSync(
            join(libDir, 'index.js'),
            `import skill from "./skill-with-assets/SKILL.md";\nexport default skill;\n`,
            'utf-8',
        );
        mkdirSync(join(libDir, 'skill-with-assets'), { recursive: true });
        writeFileSync(
            join(libDir, 'skill-with-assets', 'widget.js'),
            `export default function Widget() { return 'widget body'; }\n`,
            'utf-8',
        );

        const result = await transformImports({
            libDir,
            srcDir,
            transformers: [skillTransformer],
        });

        expect(result.chunksEmitted).toBe(1);
        expect(result.filesProcessed).toBe(1);
        expect(result.assetsCopied).toBe(2);
        expect(result.widgetsCompiled).toBe(1);

        // Import in lib/index.js was rewritten to point at the chunk.
        const rewritten = readFileSync(join(libDir, 'index.js'), 'utf-8');
        expect(rewritten).toContain('"./skill-with-assets/SKILL.md.js"');
        expect(rewritten).not.toContain('SKILL.md"');

        // The skill chunk was written and contains the expected metadata.
        const chunkPath = join(libDir, 'skill-with-assets', 'SKILL.md.js');
        expect(existsSync(chunkPath)).toBe(true);
        const chunk = readFileSync(chunkPath, 'utf-8');
        expect(chunk).toContain('export default');
        expect(chunk).toContain('"name"');
        expect(chunk).toContain('"widgets"');

        // Scripts were copied to lib/scripts/.
        expect(existsSync(join(libDir, 'scripts', 'helper.js'))).toBe(true);
        expect(existsSync(join(libDir, 'scripts', 'script.py'))).toBe(true);

        // Widget was bundled to lib/widgets/widget.js.
        expect(existsSync(join(libDir, 'widgets', 'widget.js'))).toBe(true);
    });

    it('deduplicates chunk emission when the same import appears in multiple files', async () => {
        cpSync(join(FIXTURE_ROOT, 'skill-with-assets'), join(srcDir, 'skill-with-assets'), { recursive: true });
        mkdirSync(join(libDir, 'skill-with-assets'), { recursive: true });
        writeFileSync(
            join(libDir, 'skill-with-assets', 'widget.js'),
            `export default function Widget() { return null; }\n`,
            'utf-8',
        );
        writeFileSync(
            join(libDir, 'a.js'),
            `import skill from "./skill-with-assets/SKILL.md";\nexport default skill;\n`,
            'utf-8',
        );
        writeFileSync(
            join(libDir, 'b.js'),
            `import skill from "./skill-with-assets/SKILL.md";\nexport default skill;\n`,
            'utf-8',
        );

        const result = await transformImports({
            libDir,
            srcDir,
            transformers: [skillTransformer],
            assetsDir: false,
        });

        expect(result.chunksEmitted).toBe(1);
        expect(result.filesProcessed).toBe(2);
    });

    it('handles a ?raw import end-to-end', async () => {
        const sampleDir = join(srcDir, 'samples');
        mkdirSync(sampleDir, { recursive: true });
        writeFileSync(join(sampleDir, 'doc.html'), '<p>hi</p>', 'utf-8');

        writeFileSync(
            join(libDir, 'index.js'),
            `import doc from "./samples/doc.html?raw";\nexport default doc;\n`,
            'utf-8',
        );

        const result = await transformImports({
            libDir,
            srcDir,
            transformers: [rawTransformer],
            assetsDir: false,
        });

        expect(result.chunksEmitted).toBe(1);

        const rewritten = readFileSync(join(libDir, 'index.js'), 'utf-8');
        expect(rewritten).toContain('"./samples/doc.html.js"');

        const chunkPath = join(libDir, 'samples', 'doc.html.js');
        expect(existsSync(chunkPath)).toBe(true);
        const chunk = readFileSync(chunkPath, 'utf-8');
        expect(chunk).toContain('export default');
        expect(chunk).toContain('<p>hi</p>');
    });

    it('skips asset copying and widget compilation when assetsDir is false', async () => {
        cpSync(join(FIXTURE_ROOT, 'skill-with-assets'), join(srcDir, 'skill-with-assets'), { recursive: true });
        writeFileSync(join(libDir, 'index.js'), `import skill from "./skill-with-assets/SKILL.md";\n`, 'utf-8');

        const result = await transformImports({
            libDir,
            srcDir,
            transformers: [skillTransformer],
            assetsDir: false,
        });

        expect(result.assetsCopied).toBe(0);
        expect(result.widgetsCompiled).toBe(0);
        expect(existsSync(join(libDir, 'scripts'))).toBe(false);
        expect(existsSync(join(libDir, 'widgets'))).toBe(false);
    });

    it('throws when no transformers are configured', async () => {
        await expect(
            transformImports({
                libDir,
                srcDir,
                transformers: [],
            }),
        ).rejects.toThrow(/At least one transformer/);
    });

    it('leaves unrelated files untouched', async () => {
        writeFileSync(join(libDir, 'plain.js'), `export const x = 1;\n`, 'utf-8');

        const result = await transformImports({
            libDir,
            srcDir,
            transformers: [rawTransformer],
            assetsDir: false,
        });

        expect(result.filesProcessed).toBe(0);
        expect(readFileSync(join(libDir, 'plain.js'), 'utf-8')).toBe('export const x = 1;\n');
    });

    it('recursively transforms imports inside an emitted ?skills collection chunk', async () => {
        // src/skills/<skill-dir>/SKILL.md scenario
        const skillsRoot = join(srcDir, 'skills');
        const aliceDir = join(skillsRoot, 'alice');
        mkdirSync(aliceDir, { recursive: true });
        writeFileSync(
            join(aliceDir, 'SKILL.md'),
            `---\nname: alice\ndescription: Alice the skill\n---\n# Alice\n`,
            'utf-8',
        );

        writeFileSync(
            join(libDir, 'index.js'),
            `import all from "./skills/all?skills";\nexport default all;\n`,
            'utf-8',
        );

        const result = await transformImports({
            libDir,
            srcDir,
            transformers: [skillCollectionTransformer, skillTransformer],
            assetsDir: false,
        });

        // One chunk for the ?skills collection, one for the nested SKILL.md.
        expect(result.chunksEmitted).toBe(2);

        const collectionChunk = readFileSync(join(libDir, 'skills', 'all.js'), 'utf-8');
        // The collection chunk's nested specifier must have been rewritten.
        expect(collectionChunk).toContain("from './alice/SKILL.md.js'");
        expect(collectionChunk).not.toMatch(/from '\.\/alice\/SKILL\.md'/);

        // The nested SKILL.md chunk must exist.
        expect(existsSync(join(libDir, 'skills', 'alice', 'SKILL.md.js'))).toBe(true);
    });

    it('detects /TEMPLATE.md imports alongside /SKILL.md', async () => {
        const templatesRoot = join(srcDir, 'templates');
        const reportDir = join(templatesRoot, 'report');
        mkdirSync(reportDir, { recursive: true });
        writeFileSync(
            join(reportDir, 'TEMPLATE.md'),
            `---\ndescription: Report template\ntype: document\n---\nHello\n`,
            'utf-8',
        );

        writeFileSync(
            join(libDir, 'index.js'),
            `import all from "./templates/all?templates";\nexport default all;\n`,
            'utf-8',
        );

        const result = await transformImports({
            libDir,
            srcDir,
            transformers: [templateCollectionTransformer, templateTransformer],
            assetsDir: false,
        });

        // One chunk for the ?templates collection, one for the nested TEMPLATE.md.
        expect(result.chunksEmitted).toBe(2);

        const collectionChunk = readFileSync(join(libDir, 'templates', 'all.js'), 'utf-8');
        expect(collectionChunk).toContain("from './report/TEMPLATE.md.js'");

        expect(existsSync(join(libDir, 'templates', 'report', 'TEMPLATE.md.js'))).toBe(true);
    });
});

describe('transformImports — path mapping', () => {
    let workDir: string;
    let srcDir: string;
    let libDir: string;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), 'vertesia-build-tools-paths-'));
        srcDir = join(workDir, 'src');
        libDir = join(workDir, 'lib');
        mkdirSync(srcDir, { recursive: true });
        mkdirSync(libDir, { recursive: true });
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
    });

    it('resolves nested importers against the matching nested src path', async () => {
        const nested = path.join(srcDir, 'foo', 'bar');
        mkdirSync(nested, { recursive: true });
        writeFileSync(path.join(nested, 'note.html'), 'hello', 'utf-8');

        mkdirSync(path.join(libDir, 'foo'), { recursive: true });
        writeFileSync(
            path.join(libDir, 'foo', 'mod.js'),
            `import txt from "./bar/note.html?raw";\nexport default txt;\n`,
            'utf-8',
        );

        const result = await transformImports({
            libDir,
            srcDir,
            transformers: [rawTransformer],
            assetsDir: false,
        });

        expect(result.chunksEmitted).toBe(1);
        expect(existsSync(path.join(libDir, 'foo', 'bar', 'note.html.js'))).toBe(true);

        const rewritten = readFileSync(path.join(libDir, 'foo', 'mod.js'), 'utf-8');
        expect(rewritten).toContain('"./bar/note.html.js"');
    });
});
