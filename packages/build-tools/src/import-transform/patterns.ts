/**
 * Shared regex fragments used by the scanner, detector, and orchestrator to
 * identify Vertesia query-style imports. Keep these in sync with the
 * `pattern` field of each transformer in `core/transformers/`.
 */

/**
 * Suffix tokens for `?xxx` query imports.
 */
export const QUERY_SUFFIXES = ['skill', 'raw', 'prompt', 'template', 'skills', 'templates'] as const;

/**
 * Bare filename tokens that mark an import as a transform target without a
 * `?query` suffix (e.g. `import skill from './my-skill/SKILL.md'`).
 */
export const BARE_FILENAMES = ['SKILL.md', 'TEMPLATE.md'] as const;

const QUERY_GROUP = QUERY_SUFFIXES.join('|');
const BARE_GROUP = BARE_FILENAMES.map((name) => `\\/${name.replace('.', '\\.')}`).join('|');

/**
 * Coarse sniff for whether a file body could contain any query-style imports.
 * Cheap regex check before invoking the more expensive detector.
 */
export const SNIFF_PATTERN = new RegExp(`\\?(?:${QUERY_GROUP})\\b|(?:${BARE_GROUP})\\b`);

/**
 * Matches a quoted string literal whose contents end with a query marker.
 * Capture group 1 is the quote character; capture group 2 is the specifier.
 */
export const QUERY_STRING_LITERAL = new RegExp(
    `(['"\`])([^'"\`]*?(?:\\?(?:${QUERY_GROUP})|${BARE_GROUP})[^'"\`]*)\\1`,
    'g',
);
