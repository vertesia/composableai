/**
 * Markdown math delimiter preprocessor.
 *
 * Disambiguates `$` characters in markdown so that remark-math correctly
 * distinguishes LaTeX math (`$x = \frac{1}{2}$`) from currency (`$2,847,500`).
 *
 * Uses a three-pass priority algorithm over `$` positions:
 *   1. Commit pairs matching LaTeX patterns (highest priority)
 *   2. Pair remaining positions; escape currency patterns
 *   3. Escape lone `$` adjacent to committed LaTeX pairs
 *
 * Also normalizes `\$` inside LaTeX spans into a KaTeX-compatible form,
 * since remark-math does not treat `\$` as escaped within math delimiters.
 *
 * No-ops on input without `$`. Skips fenced code blocks and inline code spans.
 */

const FENCED_CODE_BLOCK_REGEX = /(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2(?=\n|$)/g; // ```...``` or ~~~...~~~
const INLINE_CODE_REGEX = /`[^`\n]*`/g; // `...`
const ESCAPED_DOLLAR_REGEX = /\\\$/g;   // \$ inside LaTeX spans

// LaTeX positive signals
const RE_BACKSLASH_CMD = /\\[^\s]/;     // \command or \symbol (\frac, \%, \$, etc.)
const RE_BRACE_GROUP = /[{}]/;          // brace groups
const RE_SUB_SUPERSCRIPT = /[_^][\w{]/; // sub/superscript
const RE_SINGLE_LETTER = /^[a-zA-Z]$/;  // single letter variable ($r$, $x$, $t$)
const RE_VAR_ASSIGNMENT = /^[a-zA-Z]\s*=/; // variable assignment ($r = 0.235$, $n = 4$)

// LaTeX negative signals
const RE_LEADING_SPACE = /^\s/;         // space after opening $
const RE_TRAILING_SPACE = /\s$/;        // space before closing $
const RE_TRAILING_OPERATOR = /[+*/-]$/; // ends with bare operator
const RE_ION_NOTATION = /\^[+-]$/;      // except ^+ or ^- (ion notation)

/**
 * Returns true if content between `$...$` contains LaTeX structural patterns.
 */
function hasLatexPattern(content: string): boolean {
    return RE_BACKSLASH_CMD.test(content)
        || RE_BRACE_GROUP.test(content)
        || RE_SUB_SUPERSCRIPT.test(content)
        || RE_SINGLE_LETTER.test(content)
        || RE_VAR_ASSIGNMENT.test(content);
}

/**
 * Returns true if content between `$...$` has structural tells of currency dollar signs.
 */
function hasCurrencyPattern(content: string): boolean {
    if (RE_LEADING_SPACE.test(content)) return true;
    if (RE_TRAILING_SPACE.test(content)) return true;
    if (RE_TRAILING_OPERATOR.test(content) && !RE_ION_NOTATION.test(content)) return true;
    return false;
}

/**
 * Find all single-$ positions in text (skipping \$ and $$).
 */
function findSingleDollarPositions(text: string): number[] {
    const positions: number[] = [];
    for (let i = 0; i < text.length; i++) {
        if (text[i] !== "$") continue;
        if (i > 0 && text[i - 1] === "\\") continue;                         // skip \$
        if (i + 1 < text.length && text[i + 1] === "$") { i++; continue; }   // skip $$ (first)
        if (i > 0 && text[i - 1] === "$" && (i < 2 || text[i - 2] !== "\\")) continue; // skip $$ (second)
        positions.push(i);
    }
    return positions;
}

/**
 * Extract content between two $ positions. Returns null if the span is
 * empty or crosses a line boundary (invalid for inline math).
 */
function inlineMathContent(text: string, openPos: number, closePos: number): string | null {
    const content = text.slice(openPos + 1, closePos);
    if (content.length === 0 || content.includes("\n")) return null;
    return content;
}

/**
 * Classify `$` positions in a text segment, escape currency dollar signs,
 * and normalize `\$` inside LaTeX spans for remark-math compatibility.
 */
function processTextSegment(text: string): string {
    const positions = findSingleDollarPositions(text);
    if (positions.length < 2) return text;

    const committed = new Set<number>();     // position indices that are paired
    const toEscape = new Set<number>();      // character offsets in text to escape

    // Pre-compute content for each adjacent pair (avoids redundant slicing in Pass 1 & 2)
    const adjacentContent: (string | null)[] = new Array(positions.length - 1);
    for (let i = 0; i < positions.length - 1; i++) {
        adjacentContent[i] = inlineMathContent(text, positions[i], positions[i + 1]);
    }

    // Pass 1: commit definitely-LaTeX adjacent pairs and record their char boundaries
    const latexSpans: [number, number][] = [];
    for (let i = 0; i < positions.length - 1; i++) {
        if (committed.has(i)) continue;
        const content = adjacentContent[i];
        if (content !== null && hasLatexPattern(content)) {
            committed.add(i);
            committed.add(i + 1);
            latexSpans.push([positions[i], positions[i + 1]]);
        }
    }

    // Pass 2: pair remaining positions left-to-right
    let idx = 0;
    while (idx < positions.length) {
        if (committed.has(idx)) { idx++; continue; }

        // Find next uncommitted position
        let next = idx + 1;
        while (next < positions.length && committed.has(next)) next++;
        if (next >= positions.length) break;

        // If committed positions sit between idx and next, remark-math would
        // pair positions[idx] with the first committed $, breaking LaTeX.
        if (next > idx + 1) {
            toEscape.add(positions[idx]);
            idx++;
            continue;
        }

        // next === idx + 1, so we can reuse the pre-computed content
        const content = adjacentContent[idx];
        if (content === null) {
            // Cross-line pair: remark-math processes per-paragraph, so these
            // can't actually pair. Don't consume either position.
            idx++;
            continue;
        }
        if (hasCurrencyPattern(content)) {
            toEscape.add(positions[idx]);
            toEscape.add(positions[next]);
        }
        committed.add(idx);
        committed.add(next);
        idx = next + 1;
    }

    // Pass 3: escape lone $ adjacent to committed LaTeX pairs
    for (let i = 0; i < positions.length; i++) {
        if (committed.has(i)) continue;
        if (i + 1 < positions.length && committed.has(i + 1)) {
            toEscape.add(positions[i]);
        }
    }

    if (toEscape.size === 0 && latexSpans.length === 0) return text;

    // Build result: escape false-positive $ and replace \$ inside LaTeX spans
    const parts: string[] = [];
    let segStart = 0;
    const escapePositions = Array.from(toEscape).sort((a, b) => a - b);
    let escIdx = 0;
    let spanIdx = 0;

    while (escIdx < escapePositions.length || spanIdx < latexSpans.length) {
        const escPos = escIdx < escapePositions.length ? escapePositions[escIdx] : Infinity;
        const spanOpen = spanIdx < latexSpans.length ? latexSpans[spanIdx][0] : Infinity;

        if (escPos < spanOpen) {
            if (escPos > segStart) parts.push(text.slice(segStart, escPos));
            parts.push("\\$");
            segStart = escPos + 1;
            escIdx++;
        } else {
            const [open, close] = latexSpans[spanIdx];
            if (open > segStart) parts.push(text.slice(segStart, open));
            const spanContent = text.slice(open, close + 1);
            parts.push(spanContent.replace(ESCAPED_DOLLAR_REGEX, "\\text{\\textdollar}"));
            segStart = close + 1;
            while (escIdx < escapePositions.length && escapePositions[escIdx] <= close) escIdx++;
            spanIdx++;
        }
    }

    if (segStart < text.length) parts.push(text.slice(segStart));
    return parts.join("");
}

/**
 * Process text segments outside inline code spans.
 */
function processSkippingInlineCode(text: string): string {
    const parts: string[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    INLINE_CODE_REGEX.lastIndex = 0;
    while ((match = INLINE_CODE_REGEX.exec(text)) !== null) {
        parts.push(processTextSegment(text.slice(lastIndex, match.index)));
        parts.push(match[0]);
        lastIndex = match.index + match[0].length;
    }

    parts.push(processTextSegment(text.slice(lastIndex)));
    return parts.join("");
}

/**
 * Preprocess markdown to disambiguate `$` math delimiters from currency signs.
 *
 * Classification priority: LaTeX (preserve) > currency (escape) > uncertain (preserve).
 * Skips fenced code blocks and inline code spans.
 */
export function preprocessMathDelimiters(markdown: string): string {
    if (!markdown || !markdown.includes("$")) {
        return markdown;
    }

    const parts: string[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    FENCED_CODE_BLOCK_REGEX.lastIndex = 0;
    while ((match = FENCED_CODE_BLOCK_REGEX.exec(markdown)) !== null) {
        parts.push(processSkippingInlineCode(markdown.slice(lastIndex, match.index)));
        parts.push(match[0]);
        lastIndex = match.index + match[0].length;
    }

    parts.push(processSkippingInlineCode(markdown.slice(lastIndex)));
    return parts.join("");
}
