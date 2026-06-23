import { load as loadYaml } from 'js-yaml';

export interface FrontmatterResult {
    /** Parsed frontmatter data */
    frontmatter: Record<string, unknown>;

    /** Content without frontmatter */
    content: string;

    /** Original full content */
    original: string;
}

const FRONTMATTER_PATTERN = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/**
 * Parse YAML frontmatter from markdown content
 *
 * @param content - Raw markdown content with optional frontmatter
 * @returns Parsed frontmatter and content
 */
export function parseFrontmatter(content: string): FrontmatterResult {
    const match = FRONTMATTER_PATTERN.exec(content);
    if (!match) {
        return {
            frontmatter: {},
            content,
            original: content,
        };
    }

    const parsed = loadYaml(match[1] ?? '');
    const frontmatter =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};

    return {
        frontmatter,
        content: content.slice(match[0].length),
        original: content,
    };
}
