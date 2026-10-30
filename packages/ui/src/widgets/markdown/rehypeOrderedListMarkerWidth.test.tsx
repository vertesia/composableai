// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownRenderer } from './MarkdownRenderer.js';
import { getOrderedListMarkerDigits } from './rehypeOrderedListMarkerWidth.js';

afterEach(cleanup);

function markerDigits(markdown: string): string[] {
    const { container } = render(<MarkdownRenderer>{markdown}</MarkdownRenderer>);
    return Array.from(container.querySelectorAll('ol'), (ol) => ol.style.getPropertyValue('--ol-marker-digits'));
}

describe('getOrderedListMarkerDigits', () => {
    it('counts the digits of the highest marker', () => {
        expect(getOrderedListMarkerDigits(1, 9)).toBe(1);
        expect(getOrderedListMarkerDigits(1, 10)).toBe(2);
        expect(getOrderedListMarkerDigits(9, 2)).toBe(2);
        expect(getOrderedListMarkerDigits(99, 2)).toBe(3);
        expect(getOrderedListMarkerDigits(1234, 1)).toBe(4);
    });

    it('sizes markers past 10000 as 10000', () => {
        expect(getOrderedListMarkerDigits(9999, 1)).toBe(4);
        expect(getOrderedListMarkerDigits(10000, 1)).toBe(5);
        expect(getOrderedListMarkerDigits(123456789, 3)).toBe(5);
    });

    it('treats empty lists and zero or negative starts as at least one digit', () => {
        expect(getOrderedListMarkerDigits(1, 0)).toBe(1);
        expect(getOrderedListMarkerDigits(0, 1)).toBe(1);
        expect(getOrderedListMarkerDigits(-12, 1)).toBe(2);
    });
});

describe('MarkdownRenderer ordered list marker width', () => {
    it('sets the marker digits from the list start and item count', () => {
        expect(markerDigits('1. one\n2. two')).toEqual(['1']);
        expect(markerDigits('9. nine\n10. ten')).toEqual(['2']);
        expect(markerDigits('99. a\n100. b')).toEqual(['3']);
    });

    it('sizes nested lists independently', () => {
        expect(markerDigits('10. ten\n    1. nested\n11. eleven')).toEqual(['2', '1']);
    });

    it('leaves unordered lists alone', () => {
        const { container } = render(<MarkdownRenderer>{'- a\n- b'}</MarkdownRenderer>);
        expect(container.querySelector('ul')?.getAttribute('style')).toBeNull();
    });
});
