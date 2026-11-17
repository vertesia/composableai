import Handlebars from 'handlebars';
import { beforeEach, describe, expect, test } from 'vitest';
import { compiledTemplates, renderHandlebarsTemplate } from '../src/handlebars/index.js';

// Built-in helpers, the custom helpers, whitespace control, escaping and nested contexts.
const FRAGMENTS = [
    'Hello {{name}}!',
    '{{#if flag}}yes{{else}}no{{/if}}',
    '{{#each items}}[{{@index}}:{{this}}]{{/each}}',
    '{{#with nested}}{{inner}}/{{../name}}{{/with}}',
    '{{stringify nested}}',
    '{{{html}}} vs {{html}}',
    '{{~name~}}  ',
    '{{#unless flag}}off{{/unless}}',
    '{{lookup items 1}}',
    '{{_now}}',
    '{{#if (_now)}}now:{{_now}}{{/if}}',
];

function inputs(seed: number) {
    return {
        name: `user ${seed}`,
        flag: seed % 2 === 0,
        items: Array.from({ length: seed % 4 }, (_, i) => `item${seed}-${i}`),
        nested: { inner: seed, list: [seed, `${seed}`] },
        html: `<b>${seed}</b>`,
        _now: `2026-01-0${(seed % 9) + 1}T00:00:00.000Z`,
    };
}

describe('Handlebars compiled template cache', () => {
    beforeEach(() => {
        compiledTemplates.clear();
    });

    test('renders identically to a fresh compile, on misses and hits, for generated templates', () => {
        let seed = 7;
        const next = (n: number) => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % n;
        };
        for (let t = 0; t < 300; t++) {
            const template = Array.from({ length: 1 + next(5) }, () => FRAGMENTS[next(FRAGMENTS.length)]).join('\n');
            for (let render = 0; render < 3; render++) {
                const input = inputs(next(50));
                // The global instance carries the same custom helpers and is compiled fresh each time.
                const expected = Handlebars.compile(template, { noEscape: true })(input);
                expect(renderHandlebarsTemplate(template, input)).toBe(expected);
            }
        }
    });

    test('reuses the compiled template for identical source', () => {
        renderHandlebarsTemplate('Hello {{name}}', { name: 'a' });
        const compiled = compiledTemplates.get('Hello {{name}}');

        expect(renderHandlebarsTemplate('Hello {{name}}', { name: 'b' })).toBe('Hello b');
        expect(compiledTemplates.get('Hello {{name}}')).toBe(compiled);
        expect(compiledTemplates.size).toBe(1);
    });

    test('does not reuse a template for edited source', () => {
        expect(renderHandlebarsTemplate('Hello {{name}}', { name: 'a', title: 'T' })).toBe('Hello a');
        expect(renderHandlebarsTemplate('Hello {{title}}', { name: 'a', title: 'T' })).toBe('Hello T');
        expect(renderHandlebarsTemplate('Hello {{name}} ', { name: 'a', title: 'T' })).toBe('Hello a ');
        expect(compiledTemplates.size).toBe(3);
    });

    test('does not carry data from one render into the next', () => {
        const template = '{{#each items}}{{this}},{{/each}}|{{missing}}|{{_now}}';
        expect(renderHandlebarsTemplate(template, { items: [1, 2], missing: 'x', _now: 'then' })).toBe('1,2,|x|then');
        expect(renderHandlebarsTemplate(template, { items: [] })).toMatch(/^\|\|\d{4}-\d{2}-\d{2}T/);
    });

    // Prompt templates use a private environment: a helper registered later on the global instance
    // must stay unavailable to them whether the template was cached before or not.
    test('keeps helper resolution unchanged for cached templates', () => {
        const template = '{{lateHelper name}}';
        expect(() => renderHandlebarsTemplate(template, { name: 'a' })).toThrow(/Missing helper: "lateHelper"/);
        Handlebars.registerHelper('lateHelper', () => 'global');
        try {
            expect(Handlebars.compile(template)({ name: 'a' })).toBe('global');
            expect(() => renderHandlebarsTemplate(template, { name: 'a' })).toThrow(/Missing helper: "lateHelper"/);
            compiledTemplates.clear();
            expect(() => renderHandlebarsTemplate(template, { name: 'a' })).toThrow(/Missing helper: "lateHelper"/);
        } finally {
            Handlebars.unregisterHelper('lateHelper');
        }
    });

    test('throws the same error on every render of an invalid template', () => {
        const missingPartial = 'before {{> notRegistered}} after';
        const syntax = 'broken {{#if open}}';
        for (const template of [missingPartial, syntax]) {
            let first: unknown;
            try {
                renderHandlebarsTemplate(template, {});
            } catch (error: unknown) {
                first = error;
            }
            expect(first).toBeInstanceOf(Error);
            expect(() => renderHandlebarsTemplate(template, {})).toThrow((first as Error).message);
        }
    });

    test('evicts the least recently used templates by total source size', () => {
        const body = 'x'.repeat(200_000);
        const template = (i: number) => `${i}:{{name}}${body}`;
        for (let i = 0; i < 4; i++) {
            renderHandlebarsTemplate(template(i), { name: 'n' });
        }
        renderHandlebarsTemplate(template(0), { name: 'n' }); // 0 becomes the most recently used
        renderHandlebarsTemplate(template(4), { name: 'n' });
        renderHandlebarsTemplate(template(5), { name: 'n' }); // over 1,000,000 characters: evicts 1, then 2

        expect(compiledTemplates.has(template(0))).toBe(true);
        expect(compiledTemplates.has(template(1))).toBe(false);
        expect(compiledTemplates.has(template(2))).toBe(false);
        expect(compiledTemplates.calculatedSize).toBeLessThanOrEqual(1_000_000);
        // An evicted template compiles again and renders the same output.
        expect(renderHandlebarsTemplate(template(1), { name: 'again' })).toBe(`1:again${body}`);
    });

    test('caches a template larger than the cache budget on its own, evicting the rest', () => {
        renderHandlebarsTemplate('small {{name}}', { name: 'a' });
        const template = `{{name}}${'y'.repeat(1_000_001)}`;

        expect(renderHandlebarsTemplate(template, { name: 'big' }).startsWith('bigyyy')).toBe(true);
        const compiled = compiledTemplates.get(template);

        expect(compiled).toBeDefined();
        expect(compiledTemplates.size).toBe(1);
        expect(renderHandlebarsTemplate(template, { name: 'again' }).startsWith('againyyy')).toBe(true);
        expect(compiledTemplates.get(template)).toBe(compiled);
    });

    test('caches an empty template', () => {
        expect(renderHandlebarsTemplate('', { name: 'a' })).toBe('');
        expect(compiledTemplates.has('')).toBe(true);
    });
});
