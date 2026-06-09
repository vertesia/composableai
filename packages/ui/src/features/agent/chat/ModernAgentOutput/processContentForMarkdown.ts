import { AgentMessageType } from '@vertesia/common';

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
        // Regexes anchor digit/space runs with a captured (^|\D) prefix (re-emitted in the
        // replacement) and use disjoint classes instead of `\s+.+?` to avoid polynomial
        // backtracking (CodeQL js/polynomial-redos).
        if (/(?:^|\D)\d+\.[ \t]+\S/.test(formattedContent)) {
            // Format numbered lists by adding newlines between items
            formattedContent = formattedContent.replace(/(^|\D)(\d+\.[ \t]+\S.*?)(?=[ \t]+\d+\.[ \t]+|$)/g, '$1$2\n\n');

            // Make sure nested content under numbered items is properly indented
            formattedContent = formattedContent.replace(/(\d+\.\s+.+\n)([^\d\n][^:])/g, '$1  $2');
        }

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
    // Same ReDoS-safe forms as the thought-message branch above (CodeQL js/polynomial-redos).
    if (/(?:^|\D)\d+\.[ \t]+\S/.test(content) && !content.includes('\n\n')) {
        // Add proper line breaks for numbered lists that aren't already properly formatted
        return content.replace(/(^|\D)(\d+\.[ \t]+\S.*?)(?=[ \t]+\d+\.[ \t]+|$)/g, '$1$2\n\n');
    }

    return content;
}
