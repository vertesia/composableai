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
 *   [2] directive name (word chars only)
 *   [3] optional inline content (may be empty)
 *
 * Only matches when both opening and closing ::: are on the SAME line,
 * so it won't interfere with properly formatted multi-line containers.
 */
const SINGLE_LINE_DIRECTIVE = /^([ \t]*):::\s*(\w+)\s*(.*?)\s*:::[ \t]*$/gm;

export function normalizeDirectives(markdown: string): string {
    if (!markdown || !markdown.includes(':::')) {
        return markdown;
    }

    return markdown.replace(
        SINGLE_LINE_DIRECTIVE,
        (_match, indent: string, name: string, content: string) => {
            if (content) {
                // Has content → multi-line container directive
                return `${indent}:::${name}\n${indent}${content}\n${indent}:::`;
            }
            // No content → leaf directive (::name)
            return `${indent}::${name}`;
        }
    );
}
