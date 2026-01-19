/**
 * Utilities for discovering asset files (scripts, widgets) in skill directories
 */

import { readdirSync, statSync } from 'node:fs';
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
        return readdirSync(dirPath).filter(file => {
            const fullPath = path.join(dirPath, file);
            return isFile(fullPath);
        });
    } catch {
        return [];
    }
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
    } = {}
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
                type: 'script'
            });
        } else if (isWidgetFile(file)) {
            // Widget file (.tsx)
            const widgetName = getWidgetName(file);
            widgets.push(widgetName);
            widgetMetadata.push({
                name: widgetName,
                path: fullPath
            });

            // Note: We don't add widget .tsx files to assetFiles
            // Widgets are compiled by the plugin if widgetConfig is provided
        }
    }

    return {
        scripts,
        widgets,
        widgetMetadata,
        assetFiles
    };
}
