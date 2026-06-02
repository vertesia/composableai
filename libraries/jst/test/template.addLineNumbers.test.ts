import { describe, expect, test } from 'vitest';
import { renderJsTemplate } from '../src/template.js';
import { readDataFile } from './utils.js';

const content = readDataFile('template-addLineNumbers.jst');

const contentToInstrument = `
lorem ipsum
dolor sit amet
consectetur adipiscing elit
sed do eiusmod tempor incididunt
ut labore et dolore magna aliqua
`;
const input = { object: { content: contentToInstrument } };

// chai expect example
describe('JS text Templates - addLineNumbers', () => {
    test('line numbers are added', () => {
        const out = renderJsTemplate(content, ['object'], input).trim();
        console.log(out);
        const exp = /{% [0-9]+ %}/g;
        const matches = out.match(exp);
        const lineCount = contentToInstrument.trim().split('\n').length;
        expect(matches).toHaveLength(lineCount);
    });
});
