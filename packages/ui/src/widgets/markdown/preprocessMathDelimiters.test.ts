import { describe, expect, it } from 'vitest';
import { maskMathDelimiters, preprocessMathDelimiters } from './preprocessMathDelimiters';

describe('preprocessMathDelimiters', () => {
    it('preserves LaTeX patterns (commands, subscripts, superscripts, braces)', () => {
        expect(preprocessMathDelimiters('$x = \\frac{-b}{2a}$')).toBe('$x = \\frac{-b}{2a}$');
        expect(preprocessMathDelimiters('$n^2$')).toBe('$n^2$');
        expect(preprocessMathDelimiters('$a_{ij}$')).toBe('$a_{ij}$');
    });

    it('preserves single-letter variables and variable assignments', () => {
        expect(preprocessMathDelimiters('rate $r$ can be expressed')).toBe('rate $r$ can be expressed');
        expect(preprocessMathDelimiters('where $r = 0.235$ (growth)')).toBe('where $r = 0.235$ (growth)');
    });

    it('preserves ion notation (^+ and ^-)', () => {
        expect(preprocessMathDelimiters('$Ca^+$')).toBe('$Ca^+$');
        expect(preprocessMathDelimiters('$Cl^-$')).toBe('$Cl^-$');
        expect(preprocessMathDelimiters('$Ca^{2+}$')).toBe('$Ca^{2+}$');
    });

    it('preserves display math ($$...$$)', () => {
        expect(preprocessMathDelimiters('$$E = mc^2$$')).toBe('$$E = mc^2$$');
        expect(preprocessMathDelimiters('$$\nx = \\frac{-b}{2a}\n$$')).toBe('$$\nx = \\frac{-b}{2a}\n$$');
    });

    it('escapes currency amounts', () => {
        expect(preprocessMathDelimiters('between $100M and $500M')).toBe('between \\$100M and \\$500M');
        expect(preprocessMathDelimiters('all $ figures by $500k')).toBe('all \\$ figures by \\$500k');
        expect(preprocessMathDelimiters('$100K-$500K range')).toBe('\\$100K-\\$500K range');
    });

    it('escapes currency pairs that enclose prose, whatever surrounds the $', () => {
        expect(
            preprocessMathDelimiters('summed directly ($49,137,431.65) equals the sub-totals ($49,137,431.65).'),
        ).toBe('summed directly (\\$49,137,431.65) equals the sub-totals (\\$49,137,431.65).');
        expect(preprocessMathDelimiters('**−$10,710** in lost revenue with a **−$6,154.50** net drop')).toBe(
            '**−\\$10,710** in lost revenue with a **−\\$6,154.50** net drop',
        );
    });

    it.each([
        ['Totals ($10) vs ($20).', 'Totals (\\$10) vs (\\$20).'],
        ['Totals ($10) equals ($20).', 'Totals (\\$10) equals (\\$20).'],
        ['The fee is ($10), not ($20).', 'The fee is (\\$10), not (\\$20).'],
        ['Fees ($10). ($20) later.', 'Fees (\\$10). (\\$20) later.'],
        ['From $10 to [$20]', 'From \\$10 to [\\$20]'],
    ])('escapes short punctuation-wrapped currency pairs: %s', (input, expected) => {
        expect(preprocessMathDelimiters(input)).toBe(expected);
    });

    it.each(['$2xy$', '$2ab + 3cd$', 'so $2xy + 3ab$ holds', '$3 \\cdot ab$', '$2(a+b)$', '$1, 2, 3$', '$[0, 1)$'])(
        'preserves algebraic forms: %s',
        (input) => {
            expect(preprocessMathDelimiters(input)).toBe(input);
        },
    );

    it('preserves uncertain content as fallback', () => {
        expect(preprocessMathDelimiters('$100 + 200$')).toBe('$100 + 200$');
    });

    it('skips inline code and fenced code blocks', () => {
        expect(preprocessMathDelimiters('use `$100 and $200` as values')).toBe('use `$100 and $200` as values');
        const fenced = 'costs $100M and $500M\n```\nprice = $200\n```';
        expect(preprocessMathDelimiters(fenced)).toBe('costs \\$100M and \\$500M\n```\nprice = $200\n```');
    });

    it('no-ops on empty string and strings without $', () => {
        expect(preprocessMathDelimiters('')).toBe('');
        expect(preprocessMathDelimiters('no dollars here')).toBe('no dollars here');
    });

    it('does not double-escape already escaped \\$', () => {
        expect(preprocessMathDelimiters('costs \\$100')).toBe('costs \\$100');
    });

    it('replaces \\$ inside LaTeX spans with \\text{\\textdollar}', () => {
        expect(preprocessMathDelimiters('where $P = \\$2,847,500$ end')).toBe(
            'where $P = \\text{\\textdollar}2,847,500$ end',
        );
    });

    it('does not replace \\$ outside LaTeX spans', () => {
        expect(preprocessMathDelimiters('costs \\$100')).toBe('costs \\$100');
    });

    it('escapes currency $ adjacent to LaTeX pairs', () => {
        expect(preprocessMathDelimiters('costs $500M. Also $x = \\frac{1}{2}$ works')).toBe(
            'costs \\$500M. Also $x = \\frac{1}{2}$ works',
        );
    });

    it('handles currency and LaTeX on separate lines', () => {
        expect(preprocessMathDelimiters('between $100M and $500M\nwhere $x = \\frac{1}{2}$')).toBe(
            'between \\$100M and \\$500M\nwhere $x = \\frac{1}{2}$',
        );
    });

    it('handles mixed currency, LaTeX, and \\$ in a financial report line', () => {
        const input =
            'Where $F = \\$567,800$ (fixed costs), $P = \\$89.99$ (price), and $V = \\$0.42$ (variable). This yields $Q_{\\text{BE}} = 6,338$ units.';
        const result = preprocessMathDelimiters(input);
        expect(result).toContain('$F = \\text{\\textdollar}567,800$');
        expect(result).toContain('$P = \\text{\\textdollar}89.99$');
        expect(result).toContain('$V = \\text{\\textdollar}0.42$');
        expect(result).toContain('$Q_{\\text{BE}} = 6,338$');
    });

    it('handles interleaved currency, inline LaTeX, and display math', () => {
        const input =
            'The report for $500M shows that (given $sales = x*e^{y}$) we were off by $15M. This is from $$variance = x*v/2*e^(y-y`)$$';
        const result = preprocessMathDelimiters(input);
        expect(result).toContain('$sales = x*e^{y}$');
        expect(result).toContain('$$variance = x*v/2*e^(y-y`)$$');
        expect(result).toContain('\\$500M');
    });

    describe('maskMathDelimiters', () => {
        it('masks currency with a same-length stand-in instead of escaping it', () => {
            const input = 'between $100M and $500M, summed ($49,137,431.65) equals the sub-totals ($49,137,431.65).';
            const { markdown, mask } = maskMathDelimiters(input);
            if (!mask) throw new Error('Expected a mask');
            expect(markdown).toHaveLength(input.length);
            expect(markdown).not.toContain('$');
            expect(markdown.split(mask).join('$')).toBe(input);
        });

        it('masks \\$ inside LaTeX spans without changing length', () => {
            const { markdown, mask } = maskMathDelimiters('where $P = \\$2,847,500$ end');
            expect(markdown).toBe(`where $P = \\${mask}2,847,500$ end`);
        });

        it('picks a mask absent from the input, so existing symbols are left alone', () => {
            const input = 'Pfennig \u20B0 and \u20A0, totals ($10) vs ($20).';
            const { markdown, mask } = maskMathDelimiters(input);
            if (!mask) throw new Error('Expected a mask');
            expect(input).not.toContain(mask);
            expect(markdown).toBe(`Pfennig \u20B0 and \u20A0, totals (${mask}10) vs (${mask}20).`);
        });

        it('leaves LaTeX untouched and reports no mask without $', () => {
            expect(maskMathDelimiters('$x = \\frac{1}{2}$').markdown).toBe('$x = \\frac{1}{2}$');
            expect(maskMathDelimiters('no dollars')).toEqual({ markdown: 'no dollars' });
        });
    });
});
