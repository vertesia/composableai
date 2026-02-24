/**
 * Template collection transformer for directory-based template imports
 * Scans a directory for subdirectories containing TEMPLATE.md files
 */

import { readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { TransformerPreset } from '../types.js';

/**
 * Template collection transformer preset
 * Transforms directory imports with ?templates suffix into an array of template imports
 *
 * Matches:
 * - ./all?templates (recommended - generates all.js in the directory)
 * - Any path ending with a filename and ?templates
 *
 * NOTE: A filename before ?templates is REQUIRED to avoid naming conflicts.
 * The filename becomes the output module name.
 *
 * @example
 * ```typescript
 * import templates from './all?templates';
 * // Scans current directory for subdirectories with TEMPLATE.md
 * // Generates all.js containing array of all templates
 * ```
 */
export const templateCollectionTransformer: TransformerPreset = {
    pattern: /\/[^/?]+\?templates$/,
    virtual: true,
    transform: (_content: string, filePath: string) => {
        // Remove ?templates suffix and the filename to get directory path
        const pathWithoutQuery = filePath.replace(/\?templates$/, '');
        const dirPath = path.dirname(pathWithoutQuery);

        if (!existsSync(dirPath)) {
            throw new Error(`Directory not found: ${dirPath}`);
        }

        if (!statSync(dirPath).isDirectory()) {
            throw new Error(`Not a directory: ${dirPath}`);
        }

        // Scan for subdirectories containing TEMPLATE.md
        const entries = readdirSync(dirPath);
        const imports: string[] = [];
        const names: string[] = [];

        for (const entry of entries) {
            const entryPath = path.join(dirPath, entry);

            try {
                if (statSync(entryPath).isDirectory()) {
                    const templateFile = path.join(entryPath, 'TEMPLATE.md');
                    if (existsSync(templateFile)) {
                        const identifier = `Template_${entry.replace(/[^a-zA-Z0-9_]/g, '_')}`;
                        imports.push(`import ${identifier} from './${entry}/TEMPLATE.md';`);
                        names.push(identifier);
                    }
                }
            } catch (_err) {
                // Skip entries that can't be read
                continue;
            }
        }

        if (names.length === 0) {
            console.warn(`No TEMPLATE.md files found in subdirectories of ${dirPath}`);
        }

        // Generate code that imports all templates and exports as array
        const code = [
            ...imports,
            '',
            `export default [${names.join(', ')}];`
        ].join('\n');

        return {
            data: null,
            code
        };
    }
};
