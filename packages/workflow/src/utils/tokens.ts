
import { type TiktokenEncoding, get_encoding } from "tiktoken";


export type TruncateSpec = number | {
    max_tokens: number;
    encoding?: TiktokenEncoding;
}

export function truncByMaxTokens(content: string, by: TruncateSpec) {
    let encoding: TiktokenEncoding;
    let maxTokens: number;
    if (typeof by === 'number') {
        maxTokens = by;
        encoding = "cl100k_base";
    } else {
        maxTokens = by.max_tokens;
        encoding = by.encoding || "cl100k_base";
    }
    const enc = get_encoding(encoding);
    let tokens = enc.encode(content);
    if (tokens.length > maxTokens) {
        tokens = tokens.slice(0, maxTokens);
        return new TextDecoder().decode(enc.decode(tokens));
    } else {
        return content;
    }
}

export function countTokens(text: string, encoding: TiktokenEncoding = 'cl100k_base') {

    const encoder = get_encoding(encoding);
    if (!encoder) {
        throw new Error(`Unknown encoding ${encoding}`);
    }

    const tokens = encoder.encode(text);

    return {
        count: tokens.length,
        encoding: encoding,
    };

}
