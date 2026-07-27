/**
 * Finds Vertesia query-style import specifiers in a JavaScript source file and maps each one to
 * the transformer that should handle it.
 *
 * Detection uses a real ESM lexer (`es-module-lexer`) rather than a regex over string literals,
 * because a regex models the wrong thing: it matches anything that *looks* like a specifier. A doc
 * comment mentioning `` `?skill` ``, or an ordinary constant such as
 * `const example = './example/SKILL.md'`, were both detected as imports — the former resolved to a
 * directory and killed the build with `EISDIR`.
 *
 * Lexing the module handles comments, template literals, regex literals, static imports,
 * re-exports (`export … from`) and dynamic `import()` in one pass, and still yields the source
 * offsets the rewriter needs.
 */

import { initSync, parse } from 'es-module-lexer';
import type { TransformerRule } from '../core/types.js';

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

/**
 * `es-module-lexer` is WASM-backed and must be initialised before the first `parse`.
 *
 * Initialised synchronously and once, so `detectQueryImports` stays a plain function — making it
 * async would push a promise through the scanner and every caller for no benefit.
 */
let initialised = false;
function ensureInitialised(): void {
    if (!initialised) {
        initSync();
        initialised = true;
    }
}

const QUOTES = new Set(["'", '"', '`']);

/**
 * Locate the quotes around a specifier.
 *
 * The lexer reports the specifier *without* surrounding quotes for static imports but *with* them
 * for dynamic ones, and the rewriter splices over the quoted range — so normalise here rather than
 * making every caller know the difference.
 */
function quoteBounds(source: string, start: number, end: number): { quoteStart: number; quoteEnd: number } | undefined {
    if (QUOTES.has(source[start - 1]) && QUOTES.has(source[end])) {
        return { quoteStart: start - 1, quoteEnd: end + 1 };
    }
    if (QUOTES.has(source[start]) && QUOTES.has(source[end - 1])) {
        return { quoteStart: start, quoteEnd: end };
    }
    // A dynamic import whose specifier is a computed expression: nothing to rewrite.
    return undefined;
}

/**
 * Throws if `content` cannot be lexed.
 *
 * Deliberately not caught: the scanner only reaches this for files that already contain a
 * transformation marker, so a swallowed lexer failure would mean a real `?skill` import is left
 * untransformed and the raw specifier ships to the runtime. A build that cannot read a file must
 * stop, not quietly emit less. `transformImports` adds the file path to the message.
 */
export function detectQueryImports(content: string, transformers: TransformerRule[]): ImportOccurrence[] {
    ensureInitialised();

    const [imports] = parse(content);

    const occurrences: ImportOccurrence[] = [];
    for (const entry of imports) {
        const specifier = entry.n;
        if (specifier === undefined) {
            // `import.meta`, or a dynamic import with a non-literal specifier.
            continue;
        }
        const bounds = quoteBounds(content, entry.s, entry.e);
        if (!bounds) {
            continue;
        }
        const transformer = transformers.find((rule) => rule.pattern.test(specifier));
        if (!transformer) {
            continue;
        }
        occurrences.push({
            transformer,
            specifier,
            quoteStart: bounds.quoteStart,
            quoteEnd: bounds.quoteEnd,
            quote: content[bounds.quoteStart] as "'" | '"' | '`',
        });
    }

    return occurrences;
}
