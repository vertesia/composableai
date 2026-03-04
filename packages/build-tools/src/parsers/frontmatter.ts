/**
 * Frontmatter parser utility using gray-matter
 */

import matter from 'gray-matter';

export interface FrontmatterResult {
    /** Parsed frontmatter data */
    frontmatter: Record<string, any>;

    /** Content without frontmatter */
    content: string;

    /** Original full content */
    original: string;
}

/**
 * Parse YAML frontmatter from markdown content
 *
 * @param content - Raw markdown content with optional frontmatter
 * @returns Parsed frontmatter and content
 */
export function parseFrontmatter(content: string): FrontmatterResult {
    const result = matter(content);

    return {
        frontmatter: result.data,
        content: result.content,
        original: content
    };
}
