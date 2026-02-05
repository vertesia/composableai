/**
 * Frontmatter parser utility using gray-matter
 */
import matter from 'gray-matter';
/**
 * Parse YAML frontmatter from markdown content
 *
 * @param content - Raw markdown content with optional frontmatter
 * @returns Parsed frontmatter and content
 */
export function parseFrontmatter(content) {
    const result = matter(content);
    return {
        frontmatter: result.data,
        content: result.content,
        original: content
    };
}
//# sourceMappingURL=frontmatter.js.map