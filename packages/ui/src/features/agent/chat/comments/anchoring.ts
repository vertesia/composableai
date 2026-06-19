import type { Node as PMNode } from '@tiptap/pm/model';
import type { DocumentCommentAnchor } from '@vertesia/common';

/**
 * Anchoring of comments to document text via a W3C-style text-quote selector.
 *
 * We work entirely in the editor's flattened text space (the concatenation of all text
 * nodes), so that capture and re-anchor are consistent. Comments survive concurrent edits
 * because we re-locate the quote (with surrounding context) rather than trusting absolute
 * ProseMirror positions, which are invalidated by edits and by a save/reload round-trip.
 */

const CONTEXT_CHARS = 32;

interface TextSegment {
    text: string;
    /** ProseMirror position of the first character of this text node. */
    pmStart: number;
    /** Offset of this segment in the flattened document text. */
    flatStart: number;
}

interface DocTextIndex {
    flat: string;
    segments: TextSegment[];
}

function buildIndex(doc: PMNode): DocTextIndex {
    const segments: TextSegment[] = [];
    let flat = '';
    doc.descendants((node, pos) => {
        if (node.isText && node.text) {
            segments.push({ text: node.text, pmStart: pos, flatStart: flat.length });
            flat += node.text;
        }
        return true;
    });
    return { flat, segments };
}

function pmToFlat({ flat, segments }: DocTextIndex, pm: number): number {
    for (const seg of segments) {
        if (pm >= seg.pmStart && pm <= seg.pmStart + seg.text.length) {
            return seg.flatStart + (pm - seg.pmStart);
        }
    }
    return pm <= 0 ? 0 : flat.length;
}

function flatToPm(index: DocTextIndex, doc: PMNode, offset: number): number {
    for (const seg of index.segments) {
        if (offset >= seg.flatStart && offset <= seg.flatStart + seg.text.length) {
            return seg.pmStart + (offset - seg.flatStart);
        }
    }
    return offset <= 0 ? 1 : doc.content.size;
}

/** Capture a durable anchor for the current selection [from, to] (ProseMirror positions). */
export function captureAnchor(doc: PMNode, from: number, to: number): DocumentCommentAnchor {
    const index = buildIndex(doc);
    const fFrom = pmToFlat(index, from);
    const fTo = pmToFlat(index, to);
    return {
        quote: index.flat.slice(fFrom, fTo),
        prefix: index.flat.slice(Math.max(0, fFrom - CONTEXT_CHARS), fFrom),
        suffix: index.flat.slice(fTo, fTo + CONTEXT_CHARS),
        pm_from: from,
        pm_to: to,
    };
}

function commonSuffixLength(a: string, b: string): number {
    let i = 0;
    while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
    return i;
}

function commonPrefixLength(a: string, b: string): number {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
}

/** Locate the best [start, end) offset for an anchor's quote within the flattened text. */
function locate(flat: string, anchor: DocumentCommentAnchor): { start: number; end: number } | null {
    const { quote, prefix, suffix } = anchor;
    if (!quote) return null;

    // 1. Exact prefix+quote+suffix match — unambiguous.
    const exact = flat.indexOf(`${prefix}${quote}${suffix}`);
    if (exact >= 0) {
        const start = exact + prefix.length;
        return { start, end: start + quote.length };
    }

    // 2. Score every occurrence of the quote by how well its surrounding context matches.
    let best: { start: number; score: number } | null = null;
    let from = flat.indexOf(quote);
    while (from >= 0) {
        const before = flat.slice(0, from);
        const after = flat.slice(from + quote.length);
        const score = commonSuffixLength(before, prefix) + commonPrefixLength(after, suffix);
        if (!best || score > best.score) {
            best = { start: from, score };
        }
        from = flat.indexOf(quote, from + 1);
    }
    if (best) {
        return { start: best.start, end: best.start + quote.length };
    }

    return null;
}

/**
 * Re-locate an anchor in the current document, returning ProseMirror positions or null if
 * the quoted text can no longer be found (e.g. the agent deleted it).
 */
export function reanchor(doc: PMNode, anchor: DocumentCommentAnchor): { from: number; to: number } | null {
    const index = buildIndex(doc);
    const range = locate(index.flat, anchor);
    if (!range) return null;
    return {
        from: flatToPm(index, doc, range.start),
        to: flatToPm(index, doc, range.end),
    };
}
