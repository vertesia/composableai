/**
 * Utilities for copying asset files during build
 */

import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { AssetFile } from '../types.js';

/**
 * Ensure a directory exists, creating it recursively if needed
 */
function ensureDirectory(dirPath: string): void {
    try {
        mkdirSync(dirPath, { recursive: true });
    } catch (error) {
        // Ignore if directory already exists
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
            throw error;
        }
    }
}

/**
 * Copy an asset file to its destination
 *
 * @param asset - Asset file information
 * @param assetsRoot - Root directory for assets
 */
export function copyAssetFile(asset: AssetFile, assetsRoot: string): void {
    const destPath = path.join(assetsRoot, asset.destPath);
    const destDir = path.dirname(destPath);

    // Ensure destination directory exists
    ensureDirectory(destDir);

    // Copy file
    try {
        copyFileSync(asset.sourcePath, destPath);
    } catch (error) {
        throw new Error(
            `Failed to copy asset from ${asset.sourcePath} to ${destPath}: ${error instanceof Error ? error.message : String(error)
            }`
        );
    }
}

/**
 * Copy multiple asset files
 *
 * @param assets - Array of asset files to copy
 * @param assetsRoot - Root directory for assets
 * @returns Number of files copied
 */
export function copyAssets(assets: AssetFile[], assetsRoot: string): number {
    let copied = 0;

    for (const asset of assets) {
        copyAssetFile(asset, assetsRoot);
        copied++;
    }

    return copied;
}
