/**
 * Unit tests for the import-transform building blocks (detector, resolver,
 * rewriter). Scanner and chunk emitter are covered alongside the end-to-end
 * transformImports test.
 */

import { describe, expect, it } from 'vitest';
import { promptTransformer } from '../src/core/transformers/prompt.js';
import { rawTransformer } from '../src/core/transformers/raw.js';
import { skillTransformer } from '../src/core/transformers/skill.js';
import { templateTransformer } from '../src/core/transformers/template.js';
import { detectQueryImports } from '../src/import-transform/detector.js';
import { resolveImport } from '../src/import-transform/resolver.js';
import { rewriteImports } from '../src/import-transform/rewriter.js';

describe('detectQueryImports', () => {
    it('finds a ?skill import in a static import line', () => {
        const content = `import skill from "./my-skill.md?skill";\n`;
        const occurrences = detectQueryImports(content, [skillTransformer]);
        expect(occurrences).toHaveLength(1);
        expect(occurrences[0].specifier).toBe('./my-skill.md?skill');
        expect(occurrences[0].quote).toBe('"');
        expect(occurrences[0].transformer).toBe(skillTransformer);
    });

    it('finds a ?raw import with single quotes', () => {
        const content = `import txt from './doc.html?raw';\n`;
        const occurrences = detectQueryImports(content, [rawTransformer]);
        expect(occurrences).toHaveLength(1);
        expect(occurrences[0].specifier).toBe('./doc.html?raw');
        expect(occurrences[0].quote).toBe("'");
    });

    it('finds a SKILL.md import without a query suffix', () => {
        const content = `import skill from "./skills/foo/SKILL.md";\n`;
        const occurrences = detectQueryImports(content, [skillTransformer]);
        expect(occurrences).toHaveLength(1);
        expect(occurrences[0].specifier).toBe('./skills/foo/SKILL.md');
    });

    it('finds a TEMPLATE.md import without a query suffix', () => {
        const content = `import template from "./templates/report/TEMPLATE.md";\n`;
        const occurrences = detectQueryImports(content, [templateTransformer]);
        expect(occurrences).toHaveLength(1);
        expect(occurrences[0].specifier).toBe('./templates/report/TEMPLATE.md');
    });

    it('returns multiple matches across several import lines', () => {
        const content = `
import a from "./a.md?skill";
import b from './b.html?raw';
import c from "./c.hbs?prompt";
`;
        const occurrences = detectQueryImports(content, [skillTransformer, rawTransformer, promptTransformer]);
        expect(occurrences).toHaveLength(3);
        expect(occurrences.map((o) => o.specifier)).toEqual(['./a.md?skill', './b.html?raw', './c.hbs?prompt']);
    });

    it('preserves offsets that point at the surrounding quote characters', () => {
        const content = `import x from "./x.md?skill";`;
        const [occ] = detectQueryImports(content, [skillTransformer]);
        expect(content.charAt(occ.quoteStart)).toBe('"');
        expect(content.charAt(occ.quoteEnd - 1)).toBe('"');
        expect(content.slice(occ.quoteStart + 1, occ.quoteEnd - 1)).toBe(occ.specifier);
    });

    it('returns no matches for content without query imports', () => {
        const content = `import x from "./regular.js";`;
        const occurrences = detectQueryImports(content, [skillTransformer, rawTransformer]);
        expect(occurrences).toEqual([]);
    });
});

describe('resolveImport', () => {
    it('maps a ?skill import to the matching src path and chunk path', () => {
        const result = resolveImport('/abs/lib/foo/bar.js', './my-skill.md?skill', '/abs/lib', '/abs/src');
        expect(result.cleanSpecifier).toBe('./my-skill.md');
        expect(result.resolvedLibPath).toBe('/abs/lib/foo/my-skill.md');
        expect(result.resolvedSrcPath).toBe('/abs/src/foo/my-skill.md');
        expect(result.chunkLibPath).toBe('/abs/lib/foo/my-skill.md.js');
        expect(result.chunkSpecifier).toBe('./my-skill.md.js');
    });

    it('handles parent-directory specifiers', () => {
        const result = resolveImport('/abs/lib/foo/bar.js', '../shared/baz.html?raw', '/abs/lib', '/abs/src');
        expect(result.resolvedSrcPath).toBe('/abs/src/shared/baz.html');
        expect(result.chunkLibPath).toBe('/abs/lib/shared/baz.html.js');
        expect(result.chunkSpecifier).toBe('../shared/baz.html.js');
    });

    it('passes through SKILL.md specifiers (no query to strip)', () => {
        const result = resolveImport('/abs/lib/foo/bar.js', './my-skill/SKILL.md', '/abs/lib', '/abs/src');
        expect(result.cleanSpecifier).toBe('./my-skill/SKILL.md');
        expect(result.resolvedSrcPath).toBe('/abs/src/foo/my-skill/SKILL.md');
        expect(result.chunkLibPath).toBe('/abs/lib/foo/my-skill/SKILL.md.js');
        expect(result.chunkSpecifier).toBe('./my-skill/SKILL.md.js');
    });
});

describe('rewriteImports', () => {
    it('replaces a single specifier preserving the original quote style', () => {
        const content = `import x from "./foo.md?skill";`;
        const out = rewriteImports(content, [
            {
                quoteStart: content.indexOf('"'),
                quoteEnd: content.lastIndexOf('"') + 1,
                quote: '"',
                newSpecifier: './foo.md.js',
            },
        ]);
        expect(out).toBe(`import x from "./foo.md.js";`);
    });

    it('replaces multiple specifiers without index drift', () => {
        const content = `import a from "./a.md?skill";\nimport b from './b.html?raw';\n`;
        const [a, b] = (() => {
            const i1 = content.indexOf('"');
            const i2 = content.indexOf('"', i1 + 1);
            const j1 = content.indexOf("'");
            const j2 = content.indexOf("'", j1 + 1);
            return [
                { quoteStart: i1, quoteEnd: i2 + 1, quote: '"' as const, newSpecifier: './a.md.js' },
                { quoteStart: j1, quoteEnd: j2 + 1, quote: "'" as const, newSpecifier: './b.html.js' },
            ];
        })();
        const out = rewriteImports(content, [a, b]);
        expect(out).toBe(`import a from "./a.md.js";\nimport b from './b.html.js';\n`);
    });

    it('returns content unchanged when there are no replacements', () => {
        const content = `import x from "./regular.js";`;
        expect(rewriteImports(content, [])).toBe(content);
    });
});
