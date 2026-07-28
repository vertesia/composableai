/**
 * Shared regex fragments used by the scanner and orchestrator to cheaply pre-filter files that
 * could contain Vertesia query-style imports. Keep these in sync with the `pattern` field of each
 * transformer in `core/transformers/`.
 *
 * These are a *sniff* only. Deciding what is actually an import is the detector's job, and it
 * lexes the module rather than matching string literals — a literal-matching regex used to live
 * here too, and it could not tell an import from a comment or a constant.
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
