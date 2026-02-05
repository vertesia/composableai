/**
 * Frontmatter parser utility using gray-matter
 */
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
export declare function parseFrontmatter(content: string): FrontmatterResult;
//# sourceMappingURL=frontmatter.d.ts.map