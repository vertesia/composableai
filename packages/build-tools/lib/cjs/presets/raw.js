"use strict";
/**
 * Raw transformer preset for importing file content as strings
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.rawTransformer = void 0;
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
exports.rawTransformer = {
    pattern: /\?raw$/,
    transform: (content) => {
        return {
            data: content
        };
    }
};
//# sourceMappingURL=raw.js.map