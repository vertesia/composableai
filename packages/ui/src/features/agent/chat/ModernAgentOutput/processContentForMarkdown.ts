import { AgentMessageType } from '@vertesia/common';

const NUMBERED_LIST_SEPARATOR = '\n\n';

function isDigit(char: string | undefined): boolean {
    return char !== undefined && char >= '0' && char <= '9';
}

function isSpaceOrTab(char: string | undefined): boolean {
    return char === ' ' || char === '\t';
}

function isInlineContent(char: string | undefined): boolean {
    return char !== undefined && char !== ' ' && char !== '\t' && char !== '\n' && char !== '\r';
}

function numberedListMarkerContentStart(value: string, start: number): number | undefined {
    if (start > 0 && isDigit(value[start - 1])) {
        return undefined;
    }

    let index = start;
    while (isDigit(value[index])) {
        index++;
    }
    if (index === start || value[index] !== '.') {
        return undefined;
    }

    index++;
    const whitespaceStart = index;
    while (isSpaceOrTab(value[index])) {
        index++;
    }

    return index > whitespaceStart && isInlineContent(value[index]) ? index : undefined;
}

function findNumberedListMarker(value: string, fromIndex: number): number {
    for (let index = fromIndex; index < value.length; index++) {
        if (numberedListMarkerContentStart(value, index) !== undefined) {
            return index;
        }
    }
    return -1;
}

function formatInlineNumberedLists(value: string): string {
    const firstMarker = findNumberedListMarker(value, 0);
    if (firstMarker === -1) {
        return value;
    }

    let result = value.slice(0, firstMarker);
    let marker = firstMarker;

    while (marker !== -1) {
        const contentStart = numberedListMarkerContentStart(value, marker);
        const nextMarker = findNumberedListMarker(value, contentStart ?? marker + 1);

        if (nextMarker === -1) {
            result += value.slice(marker);
            result += NUMBERED_LIST_SEPARATOR;
            break;
        }

        let segmentEnd = nextMarker;
        while (segmentEnd > marker && isSpaceOrTab(value[segmentEnd - 1])) {
            segmentEnd--;
        }
        result += value.slice(marker, segmentEnd);
        result += NUMBERED_LIST_SEPARATOR;
        marker = nextMarker;
    }

    return result;
}

function lineStartsWithNumberedMarker(line: string): boolean {
    let index = 0;
    while (isSpaceOrTab(line[index])) {
        index++;
    }
    return numberedListMarkerContentStart(line, index) !== undefined;
}

function indentNestedContentUnderNumberedItems(value: string): string {
    if (!value.includes('\n')) {
        return value;
    }

    const lines = value.split('\n');
    let previousLineWasNumbered = false;
    return lines
        .map((line) => {
            const nextLine =
                previousLineWasNumbered && line.length >= 2 && !isDigit(line[0]) && line[1] !== ':'
                    ? `  ${line}`
                    : line;
            previousLineWasNumbered = lineStartsWithNumberedMarker(line);
            return nextLine;
        })
        .join('\n');
}

// PERFORMANCE: Pure function kept outside the component to avoid recreation on every render.
// Process content to enhance markdown detection for lists and thinking messages.
// Lives in its own module (no heavy UI imports) so it can be unit-tested directly —
// see processContentForMarkdown.test.ts for behavior + ReDoS-safety coverage.
export function processContentForMarkdown(
    content: string | object,
    messageType: AgentMessageType,
    originalMessage?: string,
): string | object {
    // If content is not a string, return it as is
    if (typeof content !== 'string') {
        return content;
    }

    // Special handling for thought messages to ensure proper markdown formatting
    if (
        messageType === AgentMessageType.THOUGHT ||
        (typeof originalMessage === 'string' &&
            (originalMessage.toLowerCase().includes('thinking about') ||
                originalMessage.toLowerCase().includes("i'm thinking") ||
                originalMessage.toLowerCase().includes('💭')))
    ) {
        let formattedContent = content;

        // Check for numbering patterns like "1. First item 2. Second item"
        formattedContent = indentNestedContentUnderNumberedItems(formatInlineNumberedLists(formattedContent));

        // Handle colon-prefixed items that should be on separate lines
        if (formattedContent.includes(':') && !formattedContent.includes('\n\n')) {
            formattedContent = formattedContent.replace(
                /\b(First|Next|Then|Finally|Lastly|Additionally|Step \d+):\s+/gi,
                '\n\n$&',
            );
        }

        // Handle thinking points or list-like structures even without numbers
        if (formattedContent.includes(' - ')) {
            // (^|\S) anchors the leading whitespace run to its start (re-emitted via $1) so a
            // long run of spaces isn't re-scanned at every position (CodeQL js/polynomial-redos).
            formattedContent = formattedContent.replace(/(^|\S)\s+-\s+/g, '$1\n- ');
        }

        return formattedContent;
    }

    // Normal processing for non-thinking messages
    if (!content.includes('\n\n')) {
        // Add proper line breaks for numbered lists that aren't already properly formatted
        return formatInlineNumberedLists(content);
    }

    return content;
}
