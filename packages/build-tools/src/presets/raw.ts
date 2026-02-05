/**
 * Raw transformer preset for importing file content as strings
 */

import type { TransformerPreset } from '../types.js';

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
export const rawTransformer: TransformerPreset = {
    pattern: /\?raw$/,
    transform: (content: string) => {
        return {
            data: content
        };
    }
};
