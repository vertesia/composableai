/**
 * Skill collection transformer for directory-based skill imports
 * Scans a directory for subdirectories containing SKILL.md files
 */
import type { TransformerPreset } from '../types.js';
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
export declare const skillCollectionTransformer: TransformerPreset;
//# sourceMappingURL=skill-collection.d.ts.map