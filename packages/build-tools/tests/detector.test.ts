/**
 * Tests for import detection.
 *
 * Regression history: detection used to be a regex over string literals, so anything that merely
 * *looked* like a specifier was treated as an import. A doc comment mentioning `?skill` produced
 * the specifier `?skill`, which has no path part, resolved to the importing file's own directory,
 * and failed the build with EISDIR. These cases pin the lexer-based replacement.
 */

import { describe, expect, it } from 'vitest';
import { rawTransformer } from '../src/core/transformers/raw.js';
import { skillTransformer } from '../src/core/transformers/skill.js';
import { detectQueryImports } from '../src/import-transform/detector.js';

const transformers = [skillTransformer, rawTransformer];

describe('detectQueryImports', () => {
    it('detects a static import and reports offsets that index the original source', () => {
        const source = "import s from './app-development.md?skill';";
        const found = detectQueryImports(source, transformers);

        expect(found).toHaveLength(1);
        expect(found[0].specifier).toBe('./app-development.md?skill');
        expect(source.slice(found[0].quoteStart, found[0].quoteEnd)).toBe("'./app-development.md?skill'");
        expect(found[0].quote).toBe("'");
    });

    it('detects a bare SKILL.md import', () => {
        const found = detectQueryImports("import s from './tree/SKILL.md';", transformers);
        expect(found.map((f) => f.specifier)).toEqual(['./tree/SKILL.md']);
    });

    it('detects a re-export source', () => {
        const source = "export { default } from './tree/SKILL.md';";
        const found = detectQueryImports(source, transformers);

        expect(found).toHaveLength(1);
        expect(source.slice(found[0].quoteStart, found[0].quoteEnd)).toBe("'./tree/SKILL.md'");
    });

    it('detects a dynamic import and spans its quotes correctly', () => {
        const source = "const s = await import('./late.md?raw');";
        const found = detectQueryImports(source, transformers);

        expect(found).toHaveLength(1);
        expect(found[0].specifier).toBe('./late.md?raw');
        expect(source.slice(found[0].quoteStart, found[0].quoteEnd)).toBe("'./late.md?raw'");
    });

    it('ignores an ordinary string constant that merely looks like a specifier', () => {
        // The core defect of literal-matching: this is data, not an import.
        expect(detectQueryImports("const documentationExample = './example/SKILL.md';", transformers)).toEqual([]);
    });

    it('ignores specifiers mentioned in comments', () => {
        const source = [
            '// Any Markdown carrying a skill `name` counts, not just `SKILL.md`.',
            '// `app-development.md` is imported with `?skill`.',
            "/* see './other/SKILL.md' for the tree form */",
            'export const x = 1;',
        ].join('\n');

        expect(detectQueryImports(source, transformers)).toEqual([]);
    });

    it('ignores a comment nested inside a template interpolation', () => {
        // Defeated the hand-written comment stripper: it did not track template interpolation.
        const source = ['const value = `${(() => {', "    // See './ghost.md?skill'", '    return 1;', '})()}`;'].join(
            '\n',
        );

        expect(detectQueryImports(source, transformers)).toEqual([]);
    });

    it('is not confused by a regex literal containing comment markers', () => {
        // Also defeated the hand-written stripper: `return` left `n` as the preceding character,
        // so `/[/*]x/` was read as the start of a block comment.
        const source = ["import s from './real/SKILL.md';", 'export const f = (v) => /[/*]x/.test(v);'].join('\n');
        const found = detectQueryImports(source, transformers);

        expect(found.map((f) => f.specifier)).toEqual(['./real/SKILL.md']);
    });

    it('still finds a real import in a file that also discusses the syntax', () => {
        const source = ['// discussed with `?skill` above', "import s from './app-development.md?skill';"].join('\n');
        const found = detectQueryImports(source, transformers);

        expect(found).toHaveLength(1);
        expect(source.slice(found[0].quoteStart, found[0].quoteEnd)).toBe("'./app-development.md?skill'");
    });

    it('fails closed on source it cannot lex, rather than reporting no imports', () => {
        // The scanner only reaches the detector for files that already contain a transformation
        // marker, so an empty result here would silently ship an untransformed specifier.
        expect(() => detectQueryImports('import ) from (;', transformers)).toThrow();
    });
});
