/**
 * Adds `<wbr>` break opportunities inside long unbroken runs of text in table cells.
 *
 * A table column is never narrower than the longest unbreakable run in it, so one hash, URL or raw
 * data dump would stretch its table far past the message. `overflow-wrap: anywhere` avoids that,
 * but it also lets the table squeeze a column of ordinary words down to one letter per line.
 * Instead, cells keep `overflow-wrap: break-word` and this plugin caps every run at
 * {@link MAX_UNBROKEN_LENGTH} characters: ordinary words stay whole, and long runs can wrap.
 *
 * `<wbr>` adds no characters, so copied text and in-page search are unchanged.
 *
 * Link and inline code text is left alone: custom `a` and `code` components commonly read their
 * `children` as a string (a document ID label, a file name), and a `<wbr>` would turn it into an
 * array. Those elements may break anywhere instead: see the table cell rules in typography.css and
 * agentMarkdownStyles.ts. Math is still `code` when this plugin runs (rehype-katex runs after it), so
 * it is left alone too.
 */
import type { Element, ElementContent, Root } from 'hast';
import { SKIP, visit } from 'unist-util-visit';

/** Runs up to this many characters stay whole; longer ones get break opportunities. */
export const MAX_UNBROKEN_LENGTH = 20;

/** A run may break after one of these, so URLs, paths and identifiers wrap at natural points. */
const SEPARATORS = new Set(['/', '\\', '.', '_', '-', '=', '&', '?', '#', ':', ',', ';', '|', '@', '+', '~']);

/** Spaces a browser never breaks at: they join the text on either side into one run. */
const NON_BREAKING_SPACES = '\\u00A0\\u2007\\u202F';

/** Whitespace a browser may break at, captured so that splitting keeps it. */
const BREAKABLE_SPACE = new RegExp(`([^\\S${NON_BREAKING_SPACES}]+)`, 'u');

/**
 * Cheap pre-check; counts code points, never fewer than graphemes, so it may let through a run that
 * is short in characters but never skips a long one.
 */
const POSSIBLY_LONG_RUN = new RegExp(`(?:\\S|[${NON_BREAKING_SPACES}]){${MAX_UNBROKEN_LENGTH + 1},}`, 'u');

/** Elements whose text stays a plain string for their component (see above). */
const SKIPPED_TAGS = new Set(['a', 'code']);

const graphemeSegmenter =
    typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        : undefined;

/** User-perceived characters, so an emoji sequence or accented letter is never split. */
function splitGraphemes(text: string): string[] {
    return graphemeSegmenter ? Array.from(graphemeSegmenter.segment(text), (part) => part.segment) : Array.from(text);
}

/**
 * Splits a run without breakable whitespace into pieces that may be separated by line breaks. A run
 * of at most {@link MAX_UNBROKEN_LENGTH} characters comes back whole; a longer one breaks after
 * separators, and after every {@link MAX_UNBROKEN_LENGTH} characters where there is none.
 */
export function splitLongRun(run: string): string[] {
    const graphemes = splitGraphemes(run);
    if (graphemes.length <= MAX_UNBROKEN_LENGTH) return [run];

    const pieces: string[] = [];
    let piece = '';
    let length = 0;
    graphemes.forEach((grapheme, index) => {
        piece += grapheme;
        length += 1;
        const isLast = index === graphemes.length - 1;
        if (!isLast && (SEPARATORS.has(grapheme) || length >= MAX_UNBROKEN_LENGTH)) {
            pieces.push(piece);
            piece = '';
            length = 0;
        }
    });
    pieces.push(piece);
    return pieces;
}

/** The text as text nodes separated by `<wbr>` elements, or `undefined` when it needs no break. */
function breakText(value: string): ElementContent[] | undefined {
    if (!POSSIBLY_LONG_RUN.test(value)) return undefined;

    const nodes: ElementContent[] = [];
    let text = '';
    let changed = false;
    // Splitting on a captured pattern alternates runs (even indexes) and the spaces between them.
    value.split(BREAKABLE_SPACE).forEach((part, partIndex) => {
        const pieces = partIndex % 2 === 1 ? [part] : splitLongRun(part);
        pieces.forEach((piece, index) => {
            if (index > 0) {
                nodes.push({ type: 'text', value: text });
                nodes.push({ type: 'element', tagName: 'wbr', properties: {}, children: [] });
                text = '';
                changed = true;
            }
            text += piece;
        });
    });
    if (text) nodes.push({ type: 'text', value: text });
    return changed ? nodes : undefined;
}

function addBreaks(parent: Element): void {
    for (let index = 0; index < parent.children.length; index += 1) {
        const child = parent.children[index];
        if (child.type === 'element') {
            if (!SKIPPED_TAGS.has(child.tagName)) addBreaks(child);
        } else if (child.type === 'text') {
            const replacement = breakText(child.value);
            if (replacement) {
                parent.children.splice(index, 1, ...replacement);
                index += replacement.length - 1;
            }
        }
    }
}

export function rehypeTableCellBreaks() {
    return (tree: Root) => {
        visit(tree, 'element', (node: Element) => {
            if (node.tagName !== 'td' && node.tagName !== 'th') return;
            addBreaks(node);
            return SKIP;
        });
    };
}
