import { createRequire } from 'node:module';
import type { TiktokenEncoding } from 'tiktoken';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { countTokens, truncByMaxTokens } from './tokens.js';

const tiktoken = createRequire(import.meta.url)('tiktoken') as typeof import('tiktoken');

// What truncByMaxTokens returned before it sliced the text: encode everything, keep maxTokens.
function truncateFullText(content: string, maxTokens: number, encoding: TiktokenEncoding = 'cl100k_base') {
    const enc = tiktoken.get_encoding(encoding);
    try {
        const tokens = enc.encode(content);
        if (tokens.length <= maxTokens) {
            return content;
        }
        return new TextDecoder().decode(enc.decode(tokens.slice(0, maxTokens)));
    } finally {
        enc.free();
    }
}

function fullTokenCount(content: string, encoding: TiktokenEncoding = 'cl100k_base') {
    const enc = tiktoken.get_encoding(encoding);
    try {
        return enc.encode(content).length;
    } finally {
        enc.free();
    }
}

const prose = 'The quarterly report covers revenue, margins and the outlook for next year. '.repeat(2000);
const texts: Record<string, string> = {
    prose,
    cjk: '東京都の人口は約千四百万人で、日本の首都として政治と経済の中心です。'.repeat(1500),
    emoji: 'Launch 🚀 status ✅ owner 👩🏽‍💻 '.repeat(2000),
    // One long word: the tokenizer sees it as a single chunk, so the cut falls inside it.
    blob: 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODk'.repeat(800),
    whitespace: `${' '.repeat(5000)}word\n\n\n${'\t'.repeat(3000)}end ${prose.slice(0, 20000)}`,
    // Mostly short tokens, so the first window covers too few tokens and has to grow.
    digits: '1 2 3 4 5 6 7 8 9 0 '.repeat(5000),
};

describe('truncByMaxTokens', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    for (const [name, text] of Object.entries(texts)) {
        for (const maxTokens of [1, 37, 1000, 30000]) {
            it(`matches truncating the full text (${name}, ${maxTokens} tokens)`, () => {
                expect(truncByMaxTokens(text, maxTokens)).toBe(truncateFullText(text, maxTokens));
            });
        }
    }

    it('returns short content unchanged', () => {
        expect(truncByMaxTokens('a short sentence', 100)).toBe('a short sentence');
    });

    it('returns content unchanged when it has exactly max tokens', () => {
        const text = prose.slice(0, 4000);
        expect(truncByMaxTokens(text, fullTokenCount(text))).toBe(text);
    });

    it('keeps at most max tokens', () => {
        const truncated = truncByMaxTokens(prose, 500);
        expect(fullTokenCount(truncated)).toBeLessThanOrEqual(500);
        expect(prose.startsWith(truncated)).toBe(true);
    });

    it('honours the encoding of an object spec', () => {
        const spec = { max_tokens: 200, encoding: 'o200k_base' as const };
        expect(truncByMaxTokens(texts.cjk, spec)).toBe(truncateFullText(texts.cjk, 200, 'o200k_base'));
    });

    it('encodes only a prefix of a long text', () => {
        truncByMaxTokens('warm up', 10);
        const encodedLengths: number[] = [];
        const realEncode = tiktoken.Tiktoken.prototype.encode;
        vi.spyOn(tiktoken.Tiktoken.prototype, 'encode').mockImplementation(function (
            this: InstanceType<typeof tiktoken.Tiktoken>,
            text: string,
            ...rest: unknown[]
        ) {
            encodedLengths.push(text.length);
            return realEncode.call(this, text, ...(rest as []));
        });

        truncByMaxTokens(prose, 100);

        expect(encodedLengths.length).toBeGreaterThan(0);
        expect(Math.max(...encodedLengths)).toBeLessThan(prose.length / 10);
    });

    it('builds each encoding once and reuses it', () => {
        truncByMaxTokens('warm up', 10);
        countTokens('warm up', 'p50k_base');
        const getEncoding = vi.spyOn(tiktoken, 'get_encoding');

        for (let i = 0; i < 5; i++) {
            truncByMaxTokens(prose, 50);
            countTokens(prose);
            countTokens(prose, 'p50k_base');
        }

        expect(getEncoding).not.toHaveBeenCalled();
    });
});

describe('countTokens', () => {
    it('counts every token of the text', () => {
        expect(countTokens(texts.emoji)).toEqual({ count: fullTokenCount(texts.emoji), encoding: 'cl100k_base' });
    });

    it('uses the requested encoding', () => {
        expect(countTokens(texts.cjk, 'o200k_base')).toEqual({
            count: fullTokenCount(texts.cjk, 'o200k_base'),
            encoding: 'o200k_base',
        });
    });
});
