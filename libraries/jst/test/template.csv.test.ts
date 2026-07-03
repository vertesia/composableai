import { describe, expect, test } from 'vitest';
import { renderJsTemplate } from '../src/template.js';
import { readDataFile } from './utils.js';

const content = readDataFile('template-csv.jst');

// const contentToInstrument = `
// lorem ipsum
// dolor sit amet
// consectetur adipiscing elit
// sed do eiusmod tempor incididunt
// ut labore et dolore magna aliqua
// `;

const input = {
    csv: 'name,age,sex\njohn,25,m\njane,24,f',
    options: {
        header: false,
    },
};

// chai expect example
describe('JS text Templates - csv functions', () => {
    test('parse csv', () => {
        const out = renderJsTemplate(content, ['csv', 'options'], input).trim();
        expect(out).toBe('john,25,m\njane,24,f');
    });
});
