import { describe, expect, it, vi } from 'vitest';
import { parseXML } from './useXMLViewer';

describe('parseXML', () => {
    it('parses valid XML', async () => {
        const result = await parseXML('<root><item id="1">value</item></root>');

        expect(result.valid).toBe(true);
        expect(result.json).not.toBeNull();
    });

    it('allows parsererror elements in valid XML content', async () => {
        const result = await parseXML('<root><parsererror>expected content</parsererror></root>');

        expect(result.valid).toBe(true);
        expect(result.json).not.toBeNull();
    });

    it('rejects invalid XML', async () => {
        const result = await parseXML('<root><item></root>');

        expect(result.valid).toBe(false);
        expect(result.json).toBeNull();
        expect(result.errorMessage).toContain('Fail to parse:');
    });

    // The parser module is fetched on first parse; a memoized rejection would make every later
    // parse in the session fail instantly instead of retrying.
    it('does not cache a failed parser load', async () => {
        vi.resetModules();
        let attempts = 0;
        vi.doMock('fast-xml-parser', () => {
            attempts++;
            if (attempts === 1) {
                throw new Error('chunk load failed');
            }
            return {
                XMLParser: class {
                    parse = () => [{ root: [] }];
                },
            };
        });
        const { parseXML: freshParseXML } = await import('./useXMLViewer');

        expect((await freshParseXML('<root/>')).valid).toBe(false);
        expect((await freshParseXML('<root/>')).valid).toBe(true);
        expect(attempts).toBe(2);
        vi.doUnmock('fast-xml-parser');
        vi.resetModules();
    });
    it('retries after parser construction fails and shares the successful parser', async () => {
        vi.resetModules();
        let attempts = 0;
        vi.doMock('fast-xml-parser', () => ({
            XMLParser: class {
                constructor() {
                    if (++attempts === 1) throw new Error('construction failed');
                }
                parse = () => [{ root: [] }];
            },
        }));
        try {
            const { parseXML: freshParseXML } = await import('./useXMLViewer');
            expect(await freshParseXML('<root/>')).toEqual({
                valid: false,
                json: null,
                errorMessage: 'Fail to parse: construction failed',
            });
            const results = await Promise.all([freshParseXML('<root/>'), freshParseXML('<root/>')]);
            expect(results.every((result) => result.valid)).toBe(true);
            expect(attempts).toBe(2);
            expect((await freshParseXML('<root/>')).valid).toBe(true);
            expect(attempts).toBe(2);
        } finally {
            vi.doUnmock('fast-xml-parser');
            vi.resetModules();
        }
    });
});
