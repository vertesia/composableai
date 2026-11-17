import { describe, expect, test } from 'vitest';
import { renderHandlebarsTemplate } from '../src/handlebars/index.js';

// Every character Handlebars' HTML escaping rewrites, alone and inside JSON and prose.
const VALUES = [
    `"`,
    `'`,
    '&',
    '<',
    '>',
    '=',
    '`',
    '{"messages":[{"role":"user","content":"a = b && c < d"}]}',
    `It's "quoted" <b>bold</b> & a\`tick\` with a=b`,
    '&quot; already an entity',
];

describe('Handlebars prompt rendering', () => {
    test.each(VALUES)('inserts %s as it is, with double or triple braces', (value) => {
        expect(renderHandlebarsTemplate('[{{value}}]', { value })).toBe(`[${value}]`);
        expect(renderHandlebarsTemplate('[{{{value}}}]', { value })).toBe(`[${value}]`);
    });

    test('inserts values as they are inside block helpers and nested contexts', () => {
        const template =
            '{{#each items}}{{this}}|{{/each}}{{#with nested}}{{inner}}{{/with}}{{#if flag}}{{name}}{{/if}}';
        const input = { items: ['"a"', '<b>'], nested: { inner: "it's" }, flag: true, name: 'x & y' };
        expect(renderHandlebarsTemplate(template, input)).toBe(`"a"|<b>|it's` + 'x & y');
    });
});
