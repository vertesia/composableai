/**
 * Finds Vertesia query-style import specifiers inside a JavaScript source
 * file and maps each one to the transformer that should handle it.
 *
 * The detector is regex-based and works on `tsc` output where import
 * specifiers are preserved literally. It identifies any string literal that
 * contains a known marker (`?skill`, `?raw`, …, or `/SKILL.md`) and then
 * matches the specifier against the configured transformer patterns.
 */

import type { TransformerRule } from '../core/types.js';
import { QUERY_STRING_LITERAL } from './patterns.js';

export interface ImportOccurrence {
    /** The transformer whose pattern matched the specifier. */
    transformer: TransformerRule;

    /** The original specifier text (the value between the quotes). */
    specifier: string;

    /** Offset in the source where the opening quote begins. */
    quoteStart: number;

    /** Offset in the source where the closing quote ends (exclusive). */
    quoteEnd: number;

    /** The quote character used in the source. */
    quote: "'" | '"' | '`';
}

export function detectQueryImports(content: string, transformers: TransformerRule[]): ImportOccurrence[] {
    const occurrences: ImportOccurrence[] = [];
    QUERY_STRING_LITERAL.lastIndex = 0;

    let match: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: regex .exec() loop
    while ((match = QUERY_STRING_LITERAL.exec(content)) !== null) {
        const quote = match[1] as "'" | '"' | '`';
        const specifier = match[2];

        for (const transformer of transformers) {
            if (transformer.pattern.test(specifier)) {
                occurrences.push({
                    transformer,
                    specifier,
                    quoteStart: match.index,
                    quoteEnd: match.index + match[0].length,
                    quote,
                });
                break;
            }
        }
    }

    return occurrences;
}
