import { createRequire } from 'node:module';
import type { Tiktoken, TiktokenEncoding } from 'tiktoken';

const requireCjs = createRequire(import.meta.url);

// Building an encoder parses the encoding's whole rank table, which costs far more than encoding a
// typical document, and each encoder holds WASM memory that is only released by free(). Build each
// encoding once per process and keep it.
const encoders = new Map<TiktokenEncoding, Tiktoken>();

const utf8Decoder = new TextDecoder();

// Keep token helpers synchronous without loading the WASM module until it is needed.
function getEncoding(encoding: TiktokenEncoding): Tiktoken {
    let encoder = encoders.get(encoding);
    if (!encoder) {
        const { get_encoding } = requireCjs('tiktoken') as typeof import('tiktoken');
        encoder = get_encoding(encoding);
        encoders.set(encoding, encoder);
    }
    return encoder;
}

// First guess of characters per token when slicing before encoding; English prose averages about 4.
const CHARS_PER_TOKEN_GUESS = 4;
// Tokens past the cut may differ from those of the full text, because the tokenizer only sees part
// of the last word. Encoding this many extra tokens keeps the kept ones well clear of the cut.
const CUT_MARGIN_TOKENS = 64;

export type TruncateSpec =
    | number
    | {
          max_tokens: number;
          encoding?: TiktokenEncoding;
      };

export function truncByMaxTokens(content: string, by: TruncateSpec) {
    let encoding: TiktokenEncoding;
    let maxTokens: number;
    if (typeof by === 'number') {
        maxTokens = by;
        encoding = 'cl100k_base';
    } else {
        maxTokens = by.max_tokens;
        encoding = by.encoding || 'cl100k_base';
    }
    const enc = getEncoding(encoding);
    // Encode a growing prefix rather than the whole text: callers truncate full documents to a few
    // thousand tokens, and encoding the rest would be wasted work.
    let window = Math.max(maxTokens + CUT_MARGIN_TOKENS, 1) * CHARS_PER_TOKEN_GUESS;
    while (window < content.length) {
        const tokens = enc.encode(content.slice(0, window));
        if (tokens.length > maxTokens + CUT_MARGIN_TOKENS) {
            return utf8Decoder.decode(enc.decode(tokens.slice(0, maxTokens)));
        }
        window *= 2;
    }
    const tokens = enc.encode(content);
    if (tokens.length > maxTokens) {
        return utf8Decoder.decode(enc.decode(tokens.slice(0, maxTokens)));
    }
    return content;
}

export function countTokens(text: string, encoding: TiktokenEncoding = 'cl100k_base') {
    const encoder = getEncoding(encoding);

    const tokens = encoder.encode(text);

    return {
        count: tokens.length,
        encoding: encoding,
    };
}
