const FENCED_CODE_BLOCK_REGEX = /(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2(?=\n|$)/g;
const INLINE_CODE_REGEX = /`[^`\n]*`/g;

/**
 * Positive detection: content contains LaTeX structural patterns.
 */
function isDefinitelyLatex(content: string): boolean {
    if (/\\[^\s]/.test(content)) return true;       // \command or \symbol (\frac, \%, \$, etc.)
    if (/[{}]/.test(content)) return true;          // brace groups
    if (/[_^][\w{]/.test(content)) return true;     // sub/superscript
    if (/^[a-zA-Z]$/.test(content)) return true;    // single letter variable ($r$, $x$, $t$)
    if (/^[a-zA-Z]\s*=/.test(content)) return true; // variable assignment ($r = 0.235$, $n = 4$)
    return false;
}

/**
 * Negative detection: content has structural tells of non-LaTeX dollar signs.
 */
function isDefinitelyNotLatex(content: string): boolean {
    if (/^\s/.test(content)) return true;           // space after opening $
    if (/\s$/.test(content)) return true;           // space before closing $
    // Ends with bare operator, except ^+ or ^- (ion notation)
    if (/[+*/-]$/.test(content) && !/\^[+-]$/.test(content)) return true;
    return false;
}

/**
 * Find all single-$ positions in text (skipping \$ and $$).
 */
function findDollarPositions(text: string): number[] {
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
 * Get content between two $ positions. Returns null if invalid for inline math
 * (empty, contains newline).
 */
function getContent(text: string, openPos: number, closePos: number): string | null {
    const content = text.slice(openPos + 1, closePos);
    if (content.length === 0 || content.includes("\n")) return null;
    return content;
}

/**
 * Position-based algorithm that prioritizes LaTeX pairs.
 *
 * 1. Find all single-$ positions
 * 2. Score each adjacent pair of positions: definitely LaTeX, not LaTeX, or uncertain
 * 3. Commit definitely-LaTeX pairs first (they get priority)
 * 4. Pair remaining positions left-to-right, but only if no committed pair sits between them
 * 5. Escape definitely-not-LaTeX pairs; preserve uncertain ones
 * 6. Escape any leftover lone $ that would interfere with committed LaTeX pairs
 */
function escapeInText(text: string): string {
    const positions = findDollarPositions(text);
    if (positions.length < 2) return text;

    const committed = new Set<number>();     // indices into positions[] that are paired
    const toEscape = new Set<number>();      // character positions in text to escape

    // Pass 1: commit definitely-LaTeX adjacent pairs
    for (let i = 0; i < positions.length - 1; i++) {
        if (committed.has(i)) continue;
        const content = getContent(text, positions[i], positions[i + 1]);
        if (content !== null && isDefinitelyLatex(content)) {
            committed.add(i);
            committed.add(i + 1);
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

        // Check: are there committed positions between idx and next?
        // If so, remark-math would pair positions[idx] with the first committed $,
        // breaking the LaTeX pair. We must escape positions[idx].
        let hasCommittedBetween = false;
        for (let k = idx + 1; k < next; k++) {
            if (committed.has(k)) { hasCommittedBetween = true; break; }
        }

        if (hasCommittedBetween) {
            toEscape.add(positions[idx]);
            idx++;
            continue;
        }

        const content = getContent(text, positions[idx], positions[next]);
        if (content === null) {
            // Cross-line pair: remark-math processes per-paragraph, so these can't
            // actually pair. Don't consume — let each line's $ pair independently.
            idx++;
            continue;
        }
        if (isDefinitelyNotLatex(content)) {
            toEscape.add(positions[idx]);
            toEscape.add(positions[next]);
        }
        // Whether false-latex or uncertain, both positions are consumed
        committed.add(idx);
        committed.add(next);
        idx = next + 1;
    }

    // Pass 3: escape any remaining lone $ that remark-math would pair with committed LaTeX $
    for (let i = 0; i < positions.length; i++) {
        if (committed.has(i)) continue;
        // This $ is unpaired. If remark-math's left-to-right scan would pair it with
        // a committed LaTeX $, we need to escape it.
        if (i + 1 < positions.length && committed.has(i + 1)) {
            toEscape.add(positions[i]);
        }
    }

    // Collect definitely-LaTeX span boundaries (character positions) for \$ → \textdollar{} replacement.
    // remark-math doesn't treat \$ as escaped, so \$ inside math breaks delimiter pairing.
    const latexSpans: [number, number][] = [];
    for (let i = 0; i < positions.length - 1; i++) {
        if (!committed.has(i) || !committed.has(i + 1)) continue;
        // Check this is a real pair (both committed, adjacent in committed set)
        const content = getContent(text, positions[i], positions[i + 1]);
        if (content !== null && isDefinitelyLatex(content) && !toEscape.has(positions[i])) {
            latexSpans.push([positions[i], positions[i + 1]]);
            i++; // skip the closing position
        }
    }

    if (toEscape.size === 0 && latexSpans.length === 0) return text;

    // Build result with escapes and \$ replacement inside LaTeX spans
    const parts: string[] = [];
    let segStart = 0;

    // Merge escape positions and latex span boundaries into a single sorted pass
    const escapePositions = Array.from(toEscape).sort((a, b) => a - b);
    let escIdx = 0;
    let spanIdx = 0;

    while (escIdx < escapePositions.length || spanIdx < latexSpans.length) {
        const escPos = escIdx < escapePositions.length ? escapePositions[escIdx] : Infinity;
        const spanOpen = spanIdx < latexSpans.length ? latexSpans[spanIdx][0] : Infinity;

        if (escPos < spanOpen) {
            // Emit text up to escape position, then escaped $
            if (escPos > segStart) parts.push(text.slice(segStart, escPos));
            parts.push("\\$");
            segStart = escPos + 1;
            escIdx++;
        } else {
            // Emit text up to span start, then the span content with \$ → \textdollar{}
            const [open, close] = latexSpans[spanIdx];
            if (open > segStart) parts.push(text.slice(segStart, open));
            const spanContent = text.slice(open, close + 1);
            parts.push(spanContent.replace(/\\\$/g, "\\text{\\textdollar}"));
            segStart = close + 1;
            // Skip any escape positions inside this span (shouldn't happen, but be safe)
            while (escIdx < escapePositions.length && escapePositions[escIdx] <= close) escIdx++;
            spanIdx++;
        }
    }

    if (segStart < text.length) parts.push(text.slice(segStart));
    return parts.join("");
}

function escapeOutsideInlineCode(text: string): string {
    let result = "";
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    INLINE_CODE_REGEX.lastIndex = 0;
    while ((match = INLINE_CODE_REGEX.exec(text)) !== null) {
        result += escapeInText(text.slice(lastIndex, match.index));
        result += match[0];
        lastIndex = match.index + match[0].length;
    }

    result += escapeInText(text.slice(lastIndex));
    return result;
}

/**
 * Escape `$...$` pairs that are likely not LaTeX math (e.g. currency amounts).
 *
 * Uses a position-based algorithm that finds all `$` positions and prioritizes
 * definitely-LaTeX pairs before processing the rest. This prevents real LaTeX
 * delimiters from being consumed by adjacent currency dollar signs.
 *
 * Priority: definitely LaTeX (preserve) → definitely not LaTeX (escape) → uncertain (preserve).
 * Skips fenced code blocks and inline code spans.
 */
export function escapeFalseLatex(markdown: string): string {
    if (!markdown || !markdown.includes("$")) {
        return markdown;
    }

    let result = "";
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    FENCED_CODE_BLOCK_REGEX.lastIndex = 0;
    while ((match = FENCED_CODE_BLOCK_REGEX.exec(markdown)) !== null) {
        result += escapeOutsideInlineCode(markdown.slice(lastIndex, match.index));
        result += match[0];
        lastIndex = match.index + match[0].length;
    }

    result += escapeOutsideInlineCode(markdown.slice(lastIndex));
    return result;
}
