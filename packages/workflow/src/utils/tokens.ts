import { get_encoding, type TiktokenEncoding } from 'tiktoken';

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
    const enc = get_encoding(encoding);
    try {
        let tokens = enc.encode(content);
        if (tokens.length > maxTokens) {
            tokens = tokens.slice(0, maxTokens);
            return new TextDecoder().decode(enc.decode(tokens));
        } else {
            return content;
        }
    } finally {
        enc.free();
    }
}

export function countTokens(text: string, encoding: TiktokenEncoding = 'cl100k_base') {
    const encoder = get_encoding(encoding);
    if (!encoder) {
        throw new Error(`Unknown encoding ${encoding}`);
    }

    try {
        const tokens = encoder.encode(text);

        return {
            count: tokens.length,
            encoding: encoding,
        };
    } finally {
        encoder.free();
    }
}
