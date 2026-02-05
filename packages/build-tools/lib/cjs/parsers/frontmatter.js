"use strict";
/**
 * Frontmatter parser utility using gray-matter
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFrontmatter = parseFrontmatter;
const gray_matter_1 = __importDefault(require("gray-matter"));
/**
 * Parse YAML frontmatter from markdown content
 *
 * @param content - Raw markdown content with optional frontmatter
 * @returns Parsed frontmatter and content
 */
function parseFrontmatter(content) {
    const result = (0, gray_matter_1.default)(content);
    return {
        frontmatter: result.data,
        content: result.content,
        original: content
    };
}
//# sourceMappingURL=frontmatter.js.map