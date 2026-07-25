export interface TextDiffSegment {
    type: 'equal' | 'added' | 'removed';
    text: string;
}

// Above this token count the LCS table gets expensive; fall back to a whole-text replace.
const MAX_LCS_TOKENS = 600;

function tokenize(text: string): string[] {
    return text.split(/(\s+)/).filter((token) => token.length > 0);
}

function pushSegment(segments: TextDiffSegment[], type: TextDiffSegment['type'], text: string): void {
    if (!text) return;
    const last = segments[segments.length - 1];
    if (last && last.type === type) {
        last.text += text;
    } else {
        segments.push({ type, text });
    }
}

function lcsSegments(before: string[], after: string[], segments: TextDiffSegment[]): void {
    // lengths[i][j] = LCS length of before[i..] and after[j..]
    const rows = before.length + 1;
    const cols = after.length + 1;
    const lengths = new Uint32Array(rows * cols);
    for (let i = before.length - 1; i >= 0; i--) {
        for (let j = after.length - 1; j >= 0; j--) {
            lengths[i * cols + j] =
                before[i] === after[j]
                    ? lengths[(i + 1) * cols + j + 1] + 1
                    : Math.max(lengths[(i + 1) * cols + j], lengths[i * cols + j + 1]);
        }
    }

    let i = 0;
    let j = 0;
    while (i < before.length && j < after.length) {
        if (before[i] === after[j]) {
            pushSegment(segments, 'equal', before[i]);
            i++;
            j++;
        } else if (lengths[(i + 1) * cols + j] >= lengths[i * cols + j + 1]) {
            pushSegment(segments, 'removed', before[i]);
            i++;
        } else {
            pushSegment(segments, 'added', after[j]);
            j++;
        }
    }
    pushSegment(segments, 'removed', before.slice(i).join(''));
    pushSegment(segments, 'added', after.slice(j).join(''));
}

/**
 * Word-level diff of two texts, returned as ordered segments suitable for
 * rendering a unified inline diff. Whitespace is kept in the segments so the
 * concatenation of `equal` + `removed` segments equals `before`, and
 * `equal` + `added` segments equals `after`.
 */
export function diffWordSegments(before: string, after: string): TextDiffSegment[] {
    if (before === after) {
        return before ? [{ type: 'equal', text: before }] : [];
    }

    const beforeTokens = tokenize(before);
    const afterTokens = tokenize(after);

    // Trim the common prefix and suffix so the quadratic LCS only runs on the changed middle.
    let start = 0;
    while (start < beforeTokens.length && start < afterTokens.length && beforeTokens[start] === afterTokens[start]) {
        start++;
    }
    let beforeEnd = beforeTokens.length;
    let afterEnd = afterTokens.length;
    while (beforeEnd > start && afterEnd > start && beforeTokens[beforeEnd - 1] === afterTokens[afterEnd - 1]) {
        beforeEnd--;
        afterEnd--;
    }

    const segments: TextDiffSegment[] = [];
    pushSegment(segments, 'equal', beforeTokens.slice(0, start).join(''));

    const beforeMiddle = beforeTokens.slice(start, beforeEnd);
    const afterMiddle = afterTokens.slice(start, afterEnd);
    if (beforeMiddle.length * afterMiddle.length > MAX_LCS_TOKENS * MAX_LCS_TOKENS) {
        pushSegment(segments, 'removed', beforeMiddle.join(''));
        pushSegment(segments, 'added', afterMiddle.join(''));
    } else {
        lcsSegments(beforeMiddle, afterMiddle, segments);
    }

    pushSegment(segments, 'equal', beforeTokens.slice(beforeEnd).join(''));
    return segments;
}

interface LineOp {
    type: 'equal' | 'removed' | 'added';
    line: string;
}

function lcsLineOps(before: string[], after: string[]): LineOp[] {
    const ops: LineOp[] = [];

    let start = 0;
    while (start < before.length && start < after.length && before[start] === after[start]) {
        ops.push({ type: 'equal', line: before[start] });
        start++;
    }
    let beforeEnd = before.length;
    let afterEnd = after.length;
    const tail: LineOp[] = [];
    while (beforeEnd > start && afterEnd > start && before[beforeEnd - 1] === after[afterEnd - 1]) {
        beforeEnd--;
        afterEnd--;
        tail.unshift({ type: 'equal', line: before[beforeEnd] });
    }

    const beforeMiddle = before.slice(start, beforeEnd);
    const afterMiddle = after.slice(start, afterEnd);
    if (beforeMiddle.length * afterMiddle.length > MAX_LCS_TOKENS * MAX_LCS_TOKENS) {
        for (const line of beforeMiddle) ops.push({ type: 'removed', line });
        for (const line of afterMiddle) ops.push({ type: 'added', line });
        return [...ops, ...tail];
    }

    const rows = beforeMiddle.length + 1;
    const cols = afterMiddle.length + 1;
    const lengths = new Uint32Array(rows * cols);
    for (let i = beforeMiddle.length - 1; i >= 0; i--) {
        for (let j = afterMiddle.length - 1; j >= 0; j--) {
            lengths[i * cols + j] =
                beforeMiddle[i] === afterMiddle[j]
                    ? lengths[(i + 1) * cols + j + 1] + 1
                    : Math.max(lengths[(i + 1) * cols + j], lengths[i * cols + j + 1]);
        }
    }
    let i = 0;
    let j = 0;
    while (i < beforeMiddle.length && j < afterMiddle.length) {
        if (beforeMiddle[i] === afterMiddle[j]) {
            ops.push({ type: 'equal', line: beforeMiddle[i] });
            i++;
            j++;
        } else if (lengths[(i + 1) * cols + j] >= lengths[i * cols + j + 1]) {
            ops.push({ type: 'removed', line: beforeMiddle[i] });
            i++;
        } else {
            ops.push({ type: 'added', line: afterMiddle[j] });
            j++;
        }
    }
    while (i < beforeMiddle.length) ops.push({ type: 'removed', line: beforeMiddle[i++] });
    while (j < afterMiddle.length) ops.push({ type: 'added', line: afterMiddle[j++] });
    return [...ops, ...tail];
}

function splitLinesWithEndings(text: string): string[] {
    return text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

/**
 * Document-scale text diff. Exact lines are aligned first, then word-level
 * highlighting is applied only inside each changed line hunk. This avoids the
 * word diff's bounded-LCS fallback turning a large document middle into one
 * wholesale removal and addition.
 */
export function diffTextSegments(before: string, after: string): TextDiffSegment[] {
    if (!before.includes('\n') && !after.includes('\n')) return diffWordSegments(before, after);
    if (before === after) return before ? [{ type: 'equal', text: before }] : [];

    const segments: TextDiffSegment[] = [];
    const ops = lcsLineOps(splitLinesWithEndings(before), splitLinesWithEndings(after));
    let index = 0;
    while (index < ops.length) {
        const op = ops[index];
        if (op.type === 'equal') {
            pushSegment(segments, 'equal', op.line);
            index++;
            continue;
        }

        let removed = '';
        let added = '';
        while (index < ops.length && ops[index].type !== 'equal') {
            const changed = ops[index++];
            if (changed.type === 'removed') removed += changed.line;
            if (changed.type === 'added') added += changed.line;
        }
        for (const segment of diffWordSegments(removed, added)) {
            pushSegment(segments, segment.type, segment.text);
        }
    }
    return segments;
}

export interface TextLineChangeRegion {
    /** Zero-based line in the current document where the change starts. */
    startLine: number;
    /** Inclusive zero-based line in the current document where the change ends. */
    endLine: number;
}

/** Returns distinct current-document line hunks for a change minimap. */
export function getTextLineChangeRegions(before: string, after: string): TextLineChangeRegion[] {
    if (before === after) return [];

    const regions: TextLineChangeRegion[] = [];
    const ops = lcsLineOps(before.split('\n'), after.split('\n'));
    let currentLine = 0;
    let startLine: number | undefined;

    const closeRegion = () => {
        if (startLine === undefined) return;
        regions.push({ startLine, endLine: Math.max(startLine, currentLine - 1) });
        startLine = undefined;
    };

    for (const op of ops) {
        if (op.type === 'equal') {
            closeRegion();
            currentLine++;
            continue;
        }
        startLine ??= currentLine;
        if (op.type === 'added') currentLine++;
    }
    closeRegion();
    return regions;
}

interface LineChange {
    /** Inclusive start and exclusive end in base-document line coordinates. */
    start: number;
    end: number;
    replacement: string[];
}

export type TextRebaseResult = { status: 'rebased'; content: string } | { status: 'conflict'; content: string };

function lineChanges(base: string[], changed: string[]): LineChange[] {
    const changes: LineChange[] = [];
    const ops = lcsLineOps(base, changed);
    let baseIndex = 0;
    let index = 0;
    while (index < ops.length) {
        if (ops[index].type === 'equal') {
            baseIndex++;
            index++;
            continue;
        }

        const start = baseIndex;
        const replacement: string[] = [];
        while (index < ops.length && ops[index].type !== 'equal') {
            const op = ops[index++];
            if (op.type === 'removed') baseIndex++;
            if (op.type === 'added') replacement.push(op.line);
        }
        changes.push({ start, end: baseIndex, replacement });
    }
    return changes;
}

function sameLineChange(left: LineChange, right: LineChange): boolean {
    return (
        left.start === right.start &&
        left.end === right.end &&
        left.replacement.length === right.replacement.length &&
        left.replacement.every((line, index) => line === right.replacement[index])
    );
}

function lineChangesOverlap(left: LineChange, right: LineChange): boolean {
    const leftInsertion = left.start === left.end;
    const rightInsertion = right.start === right.end;
    if (leftInsertion && rightInsertion) return left.start === right.start;
    if (leftInsertion) return left.start >= right.start && left.start <= right.end;
    if (rightInsertion) return right.start >= left.start && right.start <= left.end;
    return left.start < right.end && right.start < left.end;
}

/**
 * Conservatively reapplies local line edits onto a concurrently changed document.
 * Identical edits are deduplicated. Any overlapping base ranges return a conflict
 * and preserve `local` unchanged for recovery by the caller.
 */
export function rebaseTextChanges(base: string, local: string, remote: string): TextRebaseResult {
    if (local === remote) return { status: 'rebased', content: local };
    if (local === base) return { status: 'rebased', content: remote };
    if (remote === base) return { status: 'rebased', content: local };

    const baseLines = base.split('\n');
    const localChanges = lineChanges(baseLines, local.split('\n'));
    const remoteChanges = lineChanges(baseLines, remote.split('\n'));
    const uniqueLocalChanges: LineChange[] = [];

    for (const localChange of localChanges) {
        let duplicate = false;
        for (const remoteChange of remoteChanges) {
            if (sameLineChange(localChange, remoteChange)) {
                duplicate = true;
                break;
            }
            if (lineChangesOverlap(localChange, remoteChange)) {
                return { status: 'conflict', content: local };
            }
        }
        if (!duplicate) uniqueLocalChanges.push(localChange);
    }

    const combined = [...remoteChanges, ...uniqueLocalChanges].sort(
        (left, right) => left.start - right.start || left.end - right.end,
    );
    const merged: string[] = [];
    let cursor = 0;
    for (const change of combined) {
        merged.push(...baseLines.slice(cursor, change.start), ...change.replacement);
        cursor = change.end;
    }
    merged.push(...baseLines.slice(cursor));
    return { status: 'rebased', content: merged.join('\n') };
}

export interface UnifiedLineDiffOptions {
    /** Unchanged lines shown around each change (default 2). */
    context?: number;
    /** When set, returns undefined if the formatted diff would exceed this length. */
    maxChars?: number;
}

/**
 * Line-level unified diff (`@@ -a,b +c,d @@` hunks with `-`/`+`/space prefixes)
 * of two texts. Returns undefined when the texts are identical, or when the
 * formatted diff exceeds `maxChars` — callers fall back to a non-diff summary.
 */
export function createUnifiedLineDiff(
    before: string,
    after: string,
    options: UnifiedLineDiffOptions = {},
): string | undefined {
    if (before === after) return undefined;
    const context = options.context ?? 2;

    const ops = lcsLineOps(before.split('\n'), after.split('\n'));

    // Group changed ops into hunks, merging hunks whose context would overlap.
    const changed: Array<{ start: number; end: number }> = [];
    for (let index = 0; index < ops.length; index++) {
        if (ops[index].type === 'equal') continue;
        const previous = changed[changed.length - 1];
        if (previous && index - previous.end <= context * 2) {
            previous.end = index + 1;
        } else {
            changed.push({ start: index, end: index + 1 });
        }
    }
    if (changed.length === 0) return undefined;

    const lines: string[] = [];
    let beforeLine = 1;
    let afterLine = 1;
    let cursor = 0;
    for (const hunk of changed) {
        const start = Math.max(hunk.start - context, cursor === 0 ? 0 : cursor);
        for (; cursor < start; cursor++) {
            if (ops[cursor].type !== 'added') beforeLine++;
            if (ops[cursor].type !== 'removed') afterLine++;
        }
        const end = Math.min(hunk.end + context, ops.length);
        let beforeCount = 0;
        let afterCount = 0;
        const body: string[] = [];
        for (let index = start; index < end; index++) {
            const op = ops[index];
            if (op.type === 'equal') {
                body.push(` ${op.line}`);
                beforeCount++;
                afterCount++;
            } else if (op.type === 'removed') {
                body.push(`-${op.line}`);
                beforeCount++;
            } else {
                body.push(`+${op.line}`);
                afterCount++;
            }
        }
        lines.push(`@@ -${beforeLine},${beforeCount} +${afterLine},${afterCount} @@`, ...body);
        for (; cursor < end; cursor++) {
            if (ops[cursor].type !== 'added') beforeLine++;
            if (ops[cursor].type !== 'removed') afterLine++;
        }
    }

    const formatted = lines.join('\n');
    if (options.maxChars !== undefined && formatted.length > options.maxChars) return undefined;
    return formatted;
}
