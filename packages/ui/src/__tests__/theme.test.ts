// @vitest-environment node
/**
 * Token contract gate. The three assertions here are convention-agnostic:
 * every exposed --color-* resolves, every binding is emitted, and utilities stay
 * bound to the alias so scoped overrides work.
 *
 * The surface/foreground pairing assertions that shipped with the -foreground
 * convention were removed with it; re-add equivalents for `bg-X` -> --color-X-background.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compile } from 'tailwindcss';
import { beforeAll, describe, expect, it } from 'vitest';

const readCss = (name: string) => readFileSync(new URL(`../css/${name}.css`, import.meta.url), 'utf8');
const colorCss = readCss('color');
const themeCss = readCss('theme');
let build: (classes: string[]) => string;
let source: string;

beforeAll(async () => {
    const tailwindTheme = readFileSync(fileURLToPath(import.meta.resolve('tailwindcss/theme.css')), 'utf8');
    source = `${tailwindTheme}\n${colorCss}\n${themeCss}\n${readCss('utilities')}\n@tailwind utilities;`;
    ({ build } = await compile(source));
});

function declarations(block: string): Map<string, string> {
    return new Map([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

function resolve(name: string, tokens: Map<string, string>, seen = new Set<string>()): string {
    if (seen.has(name)) throw new Error(`Cyclic theme token: ${name}`);
    const value = tokens.get(name);
    if (!value) throw new Error(`Undefined theme token: ${name}`);
    const next = new Set(seen).add(name);
    return value.replace(/var\((--[\w-]+)\)/g, (_, ref: string) => resolve(ref, tokens, next));
}

function rule(css: string, className: string): string {
    const selector = `.${className.replaceAll('/', '\\/')} {`;
    const start = css.indexOf(selector);
    expect(start, `Missing utility ${className}`).toBeGreaterThanOrEqual(0);
    let depth = 1;
    let end = start + selector.length;
    while (depth && end < css.length) {
        if (css[end] === '{') depth++;
        if (css[end] === '}') depth--;
        end++;
    }
    return css.slice(start + selector.length, end - 1);
}

describe('theme utility contract', () => {
    for (const mode of [':root', '.dark']) {
        it(`resolves every exposed color in ${mode}`, () => {
            const root = colorCss.match(/:root\s*\{([^}]+)\}/)?.[1] ?? '';
            const dark = colorCss.match(/\.dark\s*\{([^}]+)\}/)?.[1] ?? '';
            const tokens = declarations(`${root}\n${mode === '.dark' ? dark : ''}\n${themeCss}`);
            for (const name of tokens.keys()) {
                if (name.startsWith('--color-')) {
                    expect(resolve(name, tokens), name).not.toContain('var(');
                }
            }
        });
    }

    it('emits every color binding even without utility or stylesheet consumers', async () => {
        const fresh = await compile(source);
        const emitted = declarations(fresh.build([]));
        for (const [name, value] of declarations(themeCss)) {
            if (name.startsWith('--color-')) {
                expect(emitted.get(name), name).toBe(value);
            }
        }
    });

    it('keeps utilities bound to color aliases so scoped overrides take effect', () => {
        const classes = [
            'bg-sidebar',
            'text-sidebar-foreground',
            'bg-sidebar-accent',
            'text-sidebar-accent-foreground',
            'border-sidebar-border',
        ];
        const css = build(classes);
        for (const className of classes) {
            const token = className.replace(/^(bg|text|border)-/, '--color-');
            expect(rule(css, className)).toContain(`var(${token})`);
        }
    });
});
