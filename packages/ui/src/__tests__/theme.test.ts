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

beforeAll(async () => {
    const tailwindTheme = readFileSync(fileURLToPath(import.meta.resolve('tailwindcss/theme.css')), 'utf8');
    ({ build } = await compile(
        `${tailwindTheme}\n${colorCss}\n${themeCss}\n${readCss('utilities')}\n@tailwind utilities;`,
    ));
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
                expect(body).toContain(`var(--${surface})`);
                expect(body).not.toContain(`var(--${surface}-foreground)`);
                expect(body).not.toContain(`var(--${surface}-background)`);
            }
        });
    }

    it('generates the conventional foreground utilities', () => {
        const classes = surfaces.filter((name) => name !== 'background').map((name) => `text-${name}-foreground`);
        const css = build(classes);
        for (const className of classes) {
            expect(rule(css, className)).toContain(`color: var(--${className.slice(5)})`);
        }
    });

    it('binds utilities to scoped theme tokens rather than inherited aliases', () => {
        const css = build(['bg-background', 'text-foreground', 'text-primary-foreground']);
        expect(rule(css, 'bg-background')).toContain('var(--background)');
        expect(rule(css, 'text-foreground')).toContain('var(--foreground)');
        expect(rule(css, 'text-primary-foreground')).toContain('var(--primary-foreground)');
    });
});
