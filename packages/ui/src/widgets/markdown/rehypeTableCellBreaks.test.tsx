// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownRenderer } from './MarkdownRenderer.js';
import { MAX_UNBROKEN_LENGTH, splitLongRun } from './rehypeTableCellBreaks.js';

afterEach(cleanup);

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const graphemes = (text: string) => Array.from(segmenter.segment(text), (part) => part.segment);

/** Deterministic PRNG so the generated cases are the same on every run. */
function createRandom(seed: number) {
    let state = seed;
    return () => {
        state = (state * 1664525 + 1013904223) % 2 ** 32;
        return state / 2 ** 32;
    };
}

const ALPHABET = [
    ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    ...'/\\._-=&?#:,;|@+~',
    '\u00A0', // no-break space
    '\u202F', // narrow no-break space
    'é', // precomposed
    'e\u0301', // e + combining acute accent
    '東',
    '京',
    '😀',
    '👨‍👩‍👧‍👦', // ZWJ family sequence
    '🇫🇷', // regional indicator pair
    '👍🏽', // skin-tone modifier
];

function generateRun(random: () => number, length: number): string {
    return Array.from({ length }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join('');
}

function cellRender(markdown: string) {
    const { container } = render(<MarkdownRenderer>{markdown}</MarkdownRenderer>);
    return container;
}

/** The unbroken stretches of a cell's text: split at whitespace and at `<wbr>`. */
function unbrokenRuns(cell: Element): string[] {
    const parts: string[] = [];
    let current = '';
    const walk = (node: Node) => {
        for (const child of Array.from(node.childNodes)) {
            if (child.nodeType === Node.TEXT_NODE) current += child.textContent ?? '';
            else if ((child as Element).tagName === 'WBR') {
                parts.push(current);
                current = '';
            } else walk(child);
        }
    };
    walk(cell);
    parts.push(current);
    return parts.flatMap((part) => part.split(/[^\S\u00A0\u2007\u202F]+/u)).filter(Boolean);
}

describe('splitLongRun', () => {
    it('keeps runs up to the limit whole', () => {
        expect(splitLongRun('certifications')).toEqual(['certifications']);
        expect(splitLongRun('a'.repeat(MAX_UNBROKEN_LENGTH))).toEqual(['a'.repeat(MAX_UNBROKEN_LENGTH)]);
        expect(splitLongRun('👨‍👩‍👧‍👦'.repeat(MAX_UNBROKEN_LENGTH))).toEqual(['👨‍👩‍👧‍👦'.repeat(MAX_UNBROKEN_LENGTH)]);
    });

    it('breaks after separators, then every limit-length stretch', () => {
        expect(splitLongRun('https://docs.example.com/lorem/ipsum')).toEqual([
            'https:',
            '/',
            '/',
            'docs.',
            'example.',
            'com/',
            'lorem/',
            'ipsum',
        ]);
        expect(splitLongRun('a'.repeat(45))).toEqual(['a'.repeat(20), 'a'.repeat(20), 'a'.repeat(5)]);
    });

    it('is lossless, bounded and grapheme-safe on generated runs', () => {
        const random = createRandom(2715);
        for (let caseIndex = 0; caseIndex < 2000; caseIndex += 1) {
            const run = generateRun(random, 1 + Math.floor(random() * 120));
            const pieces = splitLongRun(run);

            expect(pieces.join('')).toBe(run);
            expect(pieces.every((piece) => piece.length > 0)).toBe(true);
            // Every break falls between graphemes of the whole run, so no emoji or accent is split.
            expect(pieces.flatMap(graphemes)).toEqual(graphemes(run));
            for (const piece of pieces) {
                expect(graphemes(piece).length).toBeLessThanOrEqual(MAX_UNBROKEN_LENGTH);
            }
            if (graphemes(run).length <= MAX_UNBROKEN_LENGTH) {
                expect(pieces).toEqual([run]);
            }
        }
    });
});

describe('MarkdownRenderer table cell breaks', () => {
    it('caps every unbroken stretch of cell text without changing it', () => {
        const hash = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
        const header = 'loremipsumdolorsitametconsectetur';
        const container = cellRender(
            [`| Key | ${header} |`, '| --- | --- |', `| hash | ${hash} |`, `| bold | **${hash}** |`].join('\n'),
        );

        const cells = Array.from(container.querySelectorAll('th, td'));
        expect(cells.map((cell) => cell.textContent)).toEqual(['Key', header, 'hash', hash, 'bold', hash]);
        expect(cells[1]?.querySelector('wbr')).not.toBeNull();
        expect(cells[5]?.querySelector('strong wbr')).not.toBeNull();
        for (const cell of cells) {
            for (const run of unbrokenRuns(cell)) {
                expect(graphemes(run).length).toBeLessThanOrEqual(MAX_UNBROKEN_LENGTH);
            }
        }
    });

    it('treats text joined by no-break spaces as one run', () => {
        const amount = '12\u202F345\u202F678\u202F901\u202F234\u202F567\u00A0€';
        const container = cellRender(['| Amount |', '| --- |', `| ${amount} |`].join('\n'));

        const cell = container.querySelector('td');
        expect(cell?.textContent).toBe(amount);
        expect(cell?.querySelector('wbr')).not.toBeNull();
        for (const run of unbrokenRuns(cell as Element)) {
            expect(graphemes(run).length).toBeLessThanOrEqual(MAX_UNBROKEN_LENGTH);
        }
    });

    it('passes link and inline code text to their components as plain strings', () => {
        const documentId = '64f1c2a9e8b7d6c5b4a39281';
        const url = 'https://docs.example.com/lorem/ipsum/dolor/sit-amet-consectetur-adipiscing?elit=sed_do_eiusmod';
        const received = new Set<unknown>();
        const { container } = render(
            <MarkdownRenderer
                components={{
                    a: ({ href, children }) => {
                        received.add(children);
                        return <a href={href}>{children}</a>;
                    },
                    code: ({ children }) => {
                        received.add(children);
                        return <code>{children}</code>;
                    },
                }}
            >
                {[
                    '| Document | Link | Code |',
                    '| --- | --- | --- |',
                    `| [${documentId}](/store/objects/${documentId}) | [${url}](${url}) | \`appgen-6a23acdeac98748242db1da6\` |`,
                ].join('\n')}
            </MarkdownRenderer>,
        );

        // A Set, so the assertion holds however many times the renderer renders.
        expect([...received].sort()).toEqual(['appgen-6a23acdeac98748242db1da6', documentId, url].sort());
        expect(container.querySelector('td wbr')).toBeNull();
    });

    it('leaves text outside tables and math inside them untouched', () => {
        const longRun = 'loremipsumdolorsitametconsecteturadipiscingelit';
        const container = cellRender(
            [longRun, '', '| Formula |', '| --- |', '| $a_1+a_2+a_3+a_4+a_5+a_6+a_7+a_8$ |'].join('\n'),
        );

        expect(container.querySelector('p wbr')).toBeNull();
        expect(container.querySelector('p')?.textContent).toBe(longRun);
        expect(container.querySelector('td wbr')).toBeNull();
    });

    it('wraps tables in a horizontal scroll container that callers can replace', () => {
        const markdown = '| A | B |\n| --- | --- |\n| 1 | 2 |';
        const table = cellRender(markdown).querySelector('table');
        expect(table?.parentElement?.classList.contains('overflow-x-auto')).toBe(true);
        cleanup();

        const { container } = render(
            <MarkdownRenderer components={{ table: (props) => <table data-custom="" {...props} /> }}>
                {markdown}
            </MarkdownRenderer>,
        );
        expect(container.querySelector('table[data-custom]')).not.toBeNull();
        expect(container.querySelector('.overflow-x-auto')).toBeNull();
    });
});
