/**
 * Rewrites query-style import specifiers inside a JavaScript source file to
 * point at the chunks emitted by the chunk-emitter.
 *
 * All replacements are intra-line (only the quoted string changes), which
 * preserves line numbers — so existing source maps remain valid at the line
 * level without re-emitting them.
 */

import { writeFileSync } from 'node:fs';

export interface ImportReplacement {
    /** Offset where the opening quote begins in the original content. */
    quoteStart: number;

    /** Offset where the closing quote ends (exclusive). */
    quoteEnd: number;

    /** Quote character to wrap the new specifier with. */
    quote: "'" | '"' | '`';

    /** Replacement specifier (without quotes). */
    newSpecifier: string;
}

export function rewriteImports(content: string, replacements: ImportReplacement[]): string {
    if (replacements.length === 0) {
        return content;
    }

    const sorted = [...replacements].sort((a, b) => b.quoteStart - a.quoteStart);

    let out = content;
    for (const r of sorted) {
        const literal = `${r.quote}${r.newSpecifier}${r.quote}`;
        out = out.slice(0, r.quoteStart) + literal + out.slice(r.quoteEnd);
    }
    return out;
}

export function writeRewrittenFile(filePath: string, content: string, replacements: ImportReplacement[]): boolean {
    if (replacements.length === 0) {
        return false;
    }
    const next = rewriteImports(content, replacements);
    writeFileSync(filePath, next, 'utf-8');
    return true;
}
