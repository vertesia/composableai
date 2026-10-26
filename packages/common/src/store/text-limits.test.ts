import { describe, expect, it } from 'vitest';
import { EXTRACTED_TEXT_TRUNCATION_MARKER, MAX_EXTRACTED_TEXT_BYTES, truncateExtractedText } from './text-limits.js';

describe('truncateExtractedText', () => {
    it('leaves text within the limit unchanged', () => {
        expect(truncateExtractedText('complete text')).toEqual({
            text: 'complete text',
            truncated: false,
        });
    });

    it('keeps the stored text and marker within the UTF-8 byte limit', () => {
        const result = truncateExtractedText('x'.repeat(MAX_EXTRACTED_TEXT_BYTES + 1));

        expect(result.truncated).toBe(true);
        expect(result.text.endsWith(EXTRACTED_TEXT_TRUNCATION_MARKER)).toBe(true);
        expect(Buffer.byteLength(result.text, 'utf8')).toBe(MAX_EXTRACTED_TEXT_BYTES);
    });

    it('does not split a multi-byte Unicode code point', () => {
        const almostFull = 'x'.repeat(MAX_EXTRACTED_TEXT_BYTES - 1);
        const result = truncateExtractedText(`${almostFull}\u{1f642}`);

        expect(result.truncated).toBe(true);
        expect(result.text).not.toContain('\ufffd');
        expect(Buffer.byteLength(result.text, 'utf8')).toBeLessThanOrEqual(MAX_EXTRACTED_TEXT_BYTES);
    });
});
