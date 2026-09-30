import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseSkillFile } from './SkillCollection.js';
import type { SkillContentType, SkillDefinition, Tool } from './types.js';

/**
 * Load all tools from a directory.
 * Scans for .js files and imports tools that match naming convention.
 *
 * Directory structure:
 * ```
 * collection/
 *   tools/
 *     SearchFundsTool.js    # exports SearchFundsTool
 *     GetFundDetailsTool.js # exports GetFundDetailsTool
 * ```
 *
 * Naming convention: File should export a Tool with name matching *Tool pattern.
 *
 * @param toolsDir - Path to the tools directory (e.g., /path/to/collection/tools)
 * @returns Promise resolving to array of Tool objects
 */
export async function loadToolsFromDirectory(toolsDir: string): Promise<Tool[]> {
    const tools: Tool[] = [];

    if (!existsSync(toolsDir)) {
        console.warn(`Tools directory not found: ${toolsDir}`);
        return tools;
    }

    let entries: string[];
    try {
        entries = readdirSync(toolsDir);
    } catch {
        console.warn(`Could not read tools directory: ${toolsDir}`);
        return tools;
    }

    for (const entry of entries) {
        // Only process .js and .ts files that end with Tool
        if (!entry.endsWith('Tool.js') && !entry.endsWith('Tool.ts')) continue;
        if (entry.endsWith('.d.ts')) continue;

        const entryPath = join(toolsDir, entry);

        try {
            const stat = statSync(entryPath);
            if (!stat.isFile()) continue;

            // Dynamic import - need file:// URL for ESM
            const fileUrl = pathToFileURL(entryPath).href;
            const module = await import(fileUrl);

            // Find exported Tool (named export matching filename or any Tool export)
            const baseName = entry.replace(/\.(js|ts)$/, '');
            const tool = module[baseName] || module.default;

            if (tool && typeof tool.name === 'string' && typeof tool.run === 'function') {
                tools.push(tool);
            } else {
                console.warn(`No valid Tool export found in ${entry}`);
            }
        } catch (err) {
            console.warn(`Error loading tool from ${entry}:`, err);
        }
    }

    return tools;
}

/**
 * Load all skills from a directory.
 * Scans for subdirectories containing SKILL.md files.
 *
 * Directory structure:
 * ```
 * skills/
 *   nagare/
 *     fund-onboarding/
 *       SKILL.md
 *     monte-carlo/
 *       SKILL.md
 * ```
 *
 * @param dirPath - Path to the skills collection directory
 * @returns Array of parsed skill definitions
 */
export function loadSkillsFromDirectory(dirPath: string): SkillDefinition[] {
    const skills: SkillDefinition[] = [];

    let entries: string[];
    try {
        entries = readdirSync(dirPath);
    } catch {
        console.warn(`Could not read skills directory: ${dirPath}`);
        return skills;
    }

    for (const entry of entries) {
        const entryPath = join(dirPath, entry);

        try {
            const stat = statSync(entryPath);
            if (!stat.isDirectory()) continue;

            // Look for SKILL.md or SKILL.jst
            const mdPath = join(entryPath, 'SKILL.md');
            const jstPath = join(entryPath, 'SKILL.jst');

            let content: string | undefined;
            let contentType: SkillContentType = 'md';

            if (existsSync(mdPath)) {
                content = readFileSync(mdPath, 'utf-8');
                contentType = 'md';
            } else if (existsSync(jstPath)) {
                content = readFileSync(jstPath, 'utf-8');
                contentType = 'jst';
            }

            if (content) {
                skills.push(parseSkillFile(content, contentType));
            }
        } catch (err) {
            console.warn(`Error loading skill from ${entryPath}:`, err);
        }
    }

    return skills;
}
