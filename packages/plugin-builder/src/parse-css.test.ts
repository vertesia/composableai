import { describe, expect, it } from 'vitest';
import { extractPluginCss } from './parse-css.js';

const SAMPLE = `@layer theme, base, components, utilities;
@layer theme {
  :root, :host { --color-brand: #f43f5e; }
}
@layer base {
  * { margin: 0; }
  :root { --background: white; }
}
@layer components;
@layer utilities {
  .flex { display: flex; }
  .md\\:hidden { display: none; }
}
@property --tw-shadow { syntax: "*"; inherits: false; initial-value: 0 0 #0000; }
@keyframes spin { to { transform: rotate(360deg); } }
`;

describe('extractPluginCss', () => {
    it('preserves the source layer declaration order', () => {
        const result = extractPluginCss(SAMPLE);
        // the source's own order statement comes through first, untouched
        expect(result.startsWith('@layer theme, base, components, utilities;')).toBe(true);
        expect(result.indexOf('@layer theme {')).toBeLessThan(result.indexOf('@layer utilities {'));
    });

    it('drops the base layer block (preflight and its declarations)', () => {
        const result = extractPluginCss(SAMPLE);
        expect(result).not.toContain('margin: 0');
        expect(result).not.toContain('--background');
    });

    it('keeps theme variables, utilities, @property registrations and keyframes', () => {
        const result = extractPluginCss(SAMPLE);
        expect(result).toContain('--color-brand');
        expect(result).toContain('.flex');
        expect(result).toContain('@property --tw-shadow');
        expect(result).toContain('@keyframes spin');
    });

    it('keeps the cascade layer wrappers on the kept rules', () => {
        const result = extractPluginCss(SAMPLE);
        expect(result).toContain('@layer theme');
        expect(result).toContain('@layer utilities');
        expect(result).not.toMatch(/@layer base\s*\{/);
    });

    it('preserves the backslash escapes of Tailwind selectors', () => {
        expect(extractPluginCss(SAMPLE)).toContain('.md\\:hidden');
    });

    it('keeps every utilities block, not only the last one', () => {
        const css = '@layer utilities { .a { color: red; } }\n@layer utilities { .b { color: blue; } }';
        const result = extractPluginCss(css);
        expect(result).toContain('.a');
        expect(result).toContain('.b');
    });

    it('passes css without layers through unchanged', () => {
        const result = extractPluginCss('.a { color: red; }');
        expect(result).not.toContain('@layer');
        expect(result).toContain('.a');
    });

    it('returns an empty string for empty css', () => {
        expect(extractPluginCss('')).toBe('');
    });
});
