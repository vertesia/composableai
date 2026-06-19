import { describe, expect, it } from 'vitest';
import { normalizeDirectives } from './normalizeDirectives';

describe('normalizeDirectives', () => {
    it('returns input unchanged when there is no fence', () => {
        expect(normalizeDirectives('just some text')).toBe('just some text');
    });

    it('converts a single-line leaf directive (no content)', () => {
        expect(normalizeDirectives(':::pagebreak:::')).toBe('::pagebreak');
    });

    it('converts a single-line container directive with content', () => {
        expect(normalizeDirectives('::: tip Some content here. :::')).toBe(':::tip\nSome content here.\n:::');
    });

    it('preserves leading indentation', () => {
        expect(normalizeDirectives('  :::note hello world :::')).toBe('  :::note\n  hello world\n  :::');
    });

    it('splits the name at the first non-word char, like the original \\w+ capture', () => {
        // name = "tip", content = "-x"
        expect(normalizeDirectives(':::tip-x:::')).toBe(':::tip\n-x\n:::');
    });

    it('accepts digits in the directive name', () => {
        expect(normalizeDirectives(':::1tip:::')).toBe('::1tip');
    });

    it('leaves a fence with no valid name untouched', () => {
        expect(normalizeDirectives('::: :::')).toBe('::: :::');
        expect(normalizeDirectives(':::-x foo:::')).toBe(':::-x foo:::');
    });

    it('treats inner ::: as content rather than the closing fence', () => {
        expect(normalizeDirectives(':::tip:::extra:::')).toBe(':::tip\n:::extra\n:::');
    });

    it('only transforms single-line fences, not multi-line containers', () => {
        const multiline = ':::tip\nalready multi-line\n:::';
        expect(normalizeDirectives(multiline)).toBe(multiline);
    });

    it('processes each line independently in a document', () => {
        const input = 'before\n:::warn be careful :::\nafter';
        expect(normalizeDirectives(input)).toBe('before\n:::warn\nbe careful\n:::\nafter');
    });

    // Regression guard for CodeQL js/polynomial-redos: the previous
    // `\s*(.*?)\s*` form was quadratic on ":::0" followed by a long run of spaces.
    it('runs in linear time on a pathological single-line input', () => {
        const evil = `:::0${' '.repeat(100_000)}`;
        const start = performance.now();
        normalizeDirectives(evil);
        expect(performance.now() - start).toBeLessThan(1000);
    });
});
