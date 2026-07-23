import { describe, expect, it } from 'vitest';
import { parseXML } from './useXMLViewer';

describe('parseXML', () => {
    it('parses valid XML', () => {
        const result = parseXML('<root><item id="1">value</item></root>');

        expect(result.valid).toBe(true);
        expect(result.json).not.toBeNull();
    });

    it('rejects invalid XML', () => {
        const result = parseXML('<root><item></root>');

        expect(result.valid).toBe(false);
        expect(result.json).toBeNull();
        expect(result.errorMessage).toContain('Fail to parse:');
    });
});
