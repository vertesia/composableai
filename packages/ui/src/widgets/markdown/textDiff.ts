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
