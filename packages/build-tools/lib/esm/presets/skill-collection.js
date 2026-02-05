/**
 * Skill collection transformer for directory-based skill imports
 * Scans a directory for subdirectories containing SKILL.md files
 */
import { readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
/**
 * Skill collection transformer preset
 * Transforms directory imports with ?skills suffix into an array of skill imports
 *
 * Matches:
 * - ./all?skills (recommended - generates all.js in the directory)
 * - ./_skills?skills (generates _skills.js in the directory)
 * - Any path ending with a filename and ?skills
 *
 * NOTE: A filename before ?skills is REQUIRED to avoid naming conflicts.
 * The filename becomes the output module name.
 *
 * @example
 * ```typescript
 * import skills from './all?skills';
 * // Scans current directory for subdirectories with SKILL.md
 * // Generates all.js containing array of all skills
 * ```
 */
export const skillCollectionTransformer = {
    pattern: /\/[^/?]+\?skills$/,
    virtual: true, // Indicates this doesn't transform a real file
    transform: (_content, filePath) => {
        // Remove ?skills suffix and the filename to get directory path
        // Example: /path/code/all?skills -> /path/code/all -> /path/code/
        const pathWithoutQuery = filePath.replace(/\?skills$/, '');
        const dirPath = path.dirname(pathWithoutQuery);
        if (!existsSync(dirPath)) {
            throw new Error(`Directory not found: ${dirPath}`);
        }
        if (!statSync(dirPath).isDirectory()) {
            throw new Error(`Not a directory: ${dirPath}`);
        }
        // Scan for subdirectories containing SKILL.md
        const entries = readdirSync(dirPath);
        const imports = [];
        const names = [];
        for (const entry of entries) {
            const entryPath = path.join(dirPath, entry);
            try {
                if (statSync(entryPath).isDirectory()) {
                    const skillFile = path.join(entryPath, 'SKILL.md');
                    if (existsSync(skillFile)) {
                        // Generate unique identifier from directory name
                        const identifier = `Skill_${entry.replace(/[^a-zA-Z0-9_]/g, '_')}`;
                        imports.push(`import ${identifier} from './${entry}/SKILL.md';`);
                        names.push(identifier);
                    }
                }
            }
            catch (err) {
                // Skip entries that can't be read
                continue;
            }
        }
        if (names.length === 0) {
            console.warn(`No SKILL.md files found in subdirectories of ${dirPath}`);
        }
        // Generate code that imports all skills and exports as array
        const code = [
            ...imports,
            '',
            `export default [${names.join(', ')}];`
        ].join('\n');
        return {
            data: null, // Not used when custom code is provided
            code
        };
    }
};
//# sourceMappingURL=skill-collection.js.map