// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compile } from 'tailwindcss';
import { beforeAll, describe, expect, it } from 'vitest';

const readCss = (name: string) => readFileSync(new URL(`../css/${name}.css`, import.meta.url), 'utf8');
const colorCss = readCss('color');
const themeCss = readCss('theme');
const surfaces = [
    'background',
    'card',
    'popover',
    'primary',
    'secondary',
    'muted',
    'success',
    'attention',
    'destructive',
    'done',
    'info',
];
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

    for (const surface of surfaces) {
        it(`keeps the ${surface} token when adding opacity`, () => {
            const css = build([`bg-${surface}`, `bg-${surface}/50`]);
            for (const className of [`bg-${surface}`, `bg-${surface}/50`]) {
                const body = rule(css, className);
                expect(body).toContain(`var(--color-${surface})`);
                expect(body).not.toContain(`var(--color-${surface}-foreground)`);
                expect(body).not.toContain(`var(--color-${surface}-background)`);
            }
        });
    }

    it('generates the conventional foreground utilities', () => {
        const classes = surfaces.filter((name) => name !== 'background').map((name) => `text-${name}-foreground`);
        const css = build(classes);
        for (const className of classes) {
            expect(rule(css, className)).toContain(`color: var(--color-${className.slice(5)})`);
        }
    });

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

    for (const mode of [':root', '.dark']) {
        it(`preserves legacy surface aliases in ${mode}`, () => {
            const root = colorCss.match(/:root\s*\{([^}]+)\}/)?.[1] ?? '';
            const dark = colorCss.match(/\.dark\s*\{([^}]+)\}/)?.[1] ?? '';
            const tokens = declarations(`${build([])}\n${root}\n${mode === '.dark' ? dark : ''}`);
            for (const name of ['secondary', 'muted', 'success', 'attention', 'destructive', 'done', 'info']) {
                const scoped = declarations(mode === '.dark' ? dark : root);
                expect(scoped.get(`--${name}-background`)).toBe(`var(--${name})`);
                const expected = resolve(`--${name}`, tokens);
                expect(resolve(`--${name}-background`, tokens)).toBe(expected);
                expect(resolve(`--color-${name}-background`, tokens)).toBe(expected);
            }
            expect(resolve('--color-primary-background', tokens)).toBe(resolve('--primary-background', tokens));
        });
    }
});
