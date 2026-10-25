/**
 * Utilities for discovering asset files (scripts, widgets) in skill directories
 */

import { lstatSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { AssetFile } from '../types.js';

/**
 * Widget metadata for compilation
 */
export interface WidgetMetadata {
    /** Widget name (without .tsx extension) */
    name: string;

    /** Absolute path to widget file */
    path: string;
}

/**
 * Discovered assets in a skill directory
 */
export interface DiscoveredAssets {
    /** Script file names (with extensions: .js, .py) */
    scripts: string[];

    /** Widget file names (without .tsx extension) */
    widgets: string[];

    /** Widget metadata for compilation */
    widgetMetadata: WidgetMetadata[];

    /**
     * Agent Skills resource files, as POSIX paths relative to the skill directory
     * (e.g. `scripts/extract.py`, `references/REFERENCE.md`).
     */
    files: string[];

    /** Asset files to be copied */
    assetFiles: AssetFile[];
}

/**
 * Check if a file exists and is a regular file
 */
function isFile(filePath: string): boolean {
    try {
        return statSync(filePath).isFile();
    } catch {
        return false;
    }
}

/**
 * Get all files in a directory (non-recursive)
 */
function getFilesInDirectory(dirPath: string): string[] {
    try {
        return readdirSync(dirPath).filter((file) => {
            const fullPath = path.join(dirPath, file);
            return isFile(fullPath);
        });
    } catch {
        return [];
    }
}

/**
 * The Agent Skills resource directories (https://agentskills.io/specification), relative to the skill
 * directory. Unlike the flat scripts beside SKILL.md, their contents keep their relative paths.
 */
export const SKILL_RESOURCE_DIRS = ['scripts', 'references', 'assets'] as const;

/** Where a skill's resource files are copied, relative to the assets root. */
export const SKILL_FILES_DIR = 'skill-files';

/**
 * List the files under a directory recursively, as POSIX paths relative to `rootDir`.
 * Hidden entries and symlinks are skipped so resources cannot escape the skill directory or form cycles.
 */
function listFilesRecursive(rootDir: string, relDir: string): string[] {
    const absDir = path.join(rootDir, relDir);
    let entries: string[];
    try {
        // Reject linked resource roots as well as symlinks encountered below.
        if (!lstatSync(absDir).isDirectory()) return [];
        entries = readdirSync(absDir);
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const entry of entries.sort()) {
        if (entry.startsWith('.')) continue;
        const rel = path.posix.join(relDir, entry);
        const abs = path.join(rootDir, rel);
        try {
            const stat = lstatSync(abs);
            if (stat.isDirectory()) {
                out.push(...listFilesRecursive(rootDir, rel));
            } else if (stat.isFile()) {
                out.push(rel);
            }
        } catch {
            // Unreadable entry: skip it like the flat scan does
        }
    }
    return out;
}

/**
 * Check if a file is a script file (.js or .py)
 */
function isScriptFile(fileName: string): boolean {
    return /\.(js|py)$/.test(fileName);
}

/**
 * Check if a file is a widget file (.tsx)
 */
function isWidgetFile(fileName: string): boolean {
    return /\.tsx$/.test(fileName);
}

/**
 * Extract widget name from .tsx file (remove extension)
 */
function getWidgetName(fileName: string): string {
    return fileName.replace(/\.tsx$/, '');
}

/**
 * Discover assets (scripts and widgets) in a skill directory
 *
 * @param skillFilePath - Absolute path to the skill.md file
 * @param options - Asset discovery options
 * @returns Discovered assets and metadata
 */
export function discoverSkillAssets(
    skillFilePath: string,
    options: {
        scriptsDir?: string;
        widgetsDir?: string;
        /** Skill name used to namespace resource files; defaults to the skill directory name. */
        skillName?: string;
    } = {},
): DiscoveredAssets {
    const skillDir = path.dirname(skillFilePath);
    const files = getFilesInDirectory(skillDir);

    const scripts: string[] = [];
    const widgets: string[] = [];
    const widgetMetadata: WidgetMetadata[] = [];
    const assetFiles: AssetFile[] = [];

    const scriptsDir = options.scriptsDir || 'scripts';

    for (const file of files) {
        const fullPath = path.join(skillDir, file);

        if (isScriptFile(file)) {
            // Script file (.js or .py)
            scripts.push(file);
            assetFiles.push({
                sourcePath: fullPath,
                destPath: path.join(scriptsDir, file),
                type: 'script',
            });
        } else if (isWidgetFile(file)) {
            // Widget file (.tsx)
            const widgetName = getWidgetName(file);
            widgets.push(widgetName);
            widgetMetadata.push({
                name: widgetName,
                path: fullPath,
            });

            // Note: We don't add widget .tsx files to assetFiles
            // Widgets are compiled by the plugin if widgetConfig is provided
        }
    }

    // Agent Skills resource directories keep their relative paths and are namespaced per skill, so two
    // skills can ship files with the same name. The flat scripts above are left as they were. Only a
    // SKILL.md owns its directory; a `*.md?skill` file may share one with other skills.
    const resourceFiles =
        path.basename(skillFilePath) === 'SKILL.md'
            ? SKILL_RESOURCE_DIRS.flatMap((dir) => listFilesRecursive(skillDir, dir))
            : [];
    const skillName = options.skillName || path.basename(skillDir);
    if (resourceFiles.length > 0 && (skillName === '.' || skillName === '..' || /[\\/]/.test(skillName))) {
        throw new Error(`Invalid skill name for resource files: ${skillName}`);
    }
    for (const file of resourceFiles) {
        assetFiles.push({
            sourcePath: path.join(skillDir, file),
            destPath: path.join(SKILL_FILES_DIR, skillName, file),
            type: 'skill-file',
        });
    }

    return {
        scripts,
        widgets,
        widgetMetadata,
        files: resourceFiles,
        assetFiles,
    };
}
