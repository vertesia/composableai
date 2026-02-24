/**
 * Utilities for discovering asset files in template directories
 */

import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { AssetFile } from '../types.js';

/**
 * Discovered assets in a template directory
 */
export interface DiscoveredTemplateAssets {
    /** Asset file names (relative to template dir) */
    fileNames: string[];

    /** Asset files to be copied */
    assetFiles: AssetFile[];
}

/**
 * Files to exclude from template asset discovery
 * (source files and the template definition itself)
 */
const EXCLUDED_PATTERNS = [
    /^TEMPLATE\.md$/,
    /\.ts$/,
    /\.js$/,
];

function isExcluded(fileName: string): boolean {
    return EXCLUDED_PATTERNS.some(p => p.test(fileName));
}

/**
 * Discover asset files in a template directory.
 * All files except TEMPLATE.md, *.ts, and *.js are considered assets.
 *
 * @param templateFilePath - Absolute path to the TEMPLATE.md file
 * @param templatePath - The template path segment (e.g., "examples/report")
 * @returns Discovered assets and metadata
 */
export function discoverTemplateAssets(
    templateFilePath: string,
    templatePath: string,
): DiscoveredTemplateAssets {
    const templateDir = path.dirname(templateFilePath);
    const fileNames: string[] = [];
    const assetFiles: AssetFile[] = [];

    let files: string[];
    try {
        files = readdirSync(templateDir).filter(file => {
            try {
                return statSync(path.join(templateDir, file)).isFile();
            } catch {
                return false;
            }
        });
    } catch {
        files = [];
    }

    for (const file of files) {
        if (isExcluded(file)) {
            continue;
        }

        fileNames.push(file);
        assetFiles.push({
            sourcePath: path.join(templateDir, file),
            destPath: path.join('templates', templatePath, file),
            type: 'template',
        });
    }

    return { fileNames, assetFiles };
}
