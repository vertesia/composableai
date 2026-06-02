import { describe, expect, test } from 'vitest';
import { renderJsTemplate } from '../src/template.js';
import { readDataFile } from './utils.js';

const content = readDataFile('template-stringify.jst');

const input = { object: { name: 'Foo' } };

// chai expect example
describe('JS text Templates - stringify', () => {
    test('stringify works', () => {
        const out = renderJsTemplate(content, ['object'], input).trim();
        expect(out).toBe('{"name":"Foo"}');
    });
});
