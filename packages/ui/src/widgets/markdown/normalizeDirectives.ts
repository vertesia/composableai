/**
 * Normalize Pandoc-style single-line fenced divs into remark-directive syntax.
 *
 * Pandoc allows single-line containers:
 *   ::: pagebreak :::
 *   ::: tip Some content here. :::
 *
 * remark-directive requires multi-line containers:
 *   :::pagebreak
 *   :::
 *
 *   :::tip
 *   Some content here.
 *   :::
 *
 * This preprocessor converts the single-line form into multi-line so that
 * remark-directive can parse them correctly.
 */

/**
 * Regex matching a single-line fenced div:
 *   ::: name optional-content :::
 *
 * Groups:
 *   [1] leading indent
 *   [2] raw text between the opening and closing fences
 *
 * The directive name and optional inline content are split from group [2] in JS.
 *
 * Only matches when both opening and closing ::: are on the SAME line,
 * so it won't interfere with properly formatted multi-line containers.
 */
// Capture the indent and the raw text between the opening and closing fences. The
// name/content split is done in JS rather than with adjacent `\s*(\w+)\s*(.*?)\s*`
// groups, which exhibit polynomial backtracking (CodeQL js/polynomial-redos).
const SINGLE_LINE_DIRECTIVE = /^([ \t]*):::([^\n]*?):::[ \t]*$/gm;
const DIRECTIVE_NAME = /^\w+/;

export function normalizeDirectives(markdown: string): string {
    if (!markdown?.includes(':::')) {
        return markdown;
    }

    return markdown.replace(SINGLE_LINE_DIRECTIVE, (match, indent: string, inner: string) => {
        const trimmed = inner.trim();
        const nameMatch = DIRECTIVE_NAME.exec(trimmed);
        if (!nameMatch) {
            // No valid directive name → not a single-line directive, leave untouched.
            return match;
        }
        const name = nameMatch[0];
        const content = trimmed.slice(name.length).trim();
        if (content) {
            // Has content → multi-line container directive
            return `${indent}:::${name}\n${indent}${content}\n${indent}:::`;
        }
        // No content → leaf directive (::name)
        return `${indent}::${name}`;
    });
}
