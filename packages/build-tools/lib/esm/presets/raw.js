/**
 * Raw transformer preset for importing file content as strings
 */
/**
 * Raw transformer preset
 * Transforms any file with ?raw suffix into a string export
 *
 * @example
 * ```typescript
 * import template from './template.html?raw';
 * // template is a string containing the file content
 * ```
 */
export const rawTransformer = {
    pattern: /\?raw$/,
    transform: (content) => {
        return {
            data: content
        };
    }
};
//# sourceMappingURL=raw.js.map