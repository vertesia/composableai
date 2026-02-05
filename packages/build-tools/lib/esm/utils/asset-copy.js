/**
 * Utilities for copying asset files during build
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
/**
 * Ensure a directory exists, creating it recursively if needed
 */
function ensureDirectory(dirPath) {
    try {
        mkdirSync(dirPath, { recursive: true });
    }
    catch (error) {
        // Ignore if directory already exists
        if (error.code !== 'EEXIST') {
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
export function copyAssetFile(asset, assetsRoot) {
    const destPath = path.join(assetsRoot, asset.destPath);
    const destDir = path.dirname(destPath);
    // Ensure destination directory exists
    ensureDirectory(destDir);
    // Copy file
    try {
        copyFileSync(asset.sourcePath, destPath);
    }
    catch (error) {
        throw new Error(`Failed to copy asset from ${asset.sourcePath} to ${destPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Copy multiple asset files
 *
 * @param assets - Array of asset files to copy
 * @param assetsRoot - Root directory for assets
 * @returns Number of files copied
 */
export function copyAssets(assets, assetsRoot) {
    let copied = 0;
    for (const asset of assets) {
        copyAssetFile(asset, assetsRoot);
        copied++;
    }
    return copied;
}
//# sourceMappingURL=asset-copy.js.map