"use strict";
/**
 * Utilities for copying asset files during build
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.copyAssetFile = copyAssetFile;
exports.copyAssets = copyAssets;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
/**
 * Ensure a directory exists, creating it recursively if needed
 */
function ensureDirectory(dirPath) {
    try {
        (0, node_fs_1.mkdirSync)(dirPath, { recursive: true });
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
function copyAssetFile(asset, assetsRoot) {
    const destPath = node_path_1.default.join(assetsRoot, asset.destPath);
    const destDir = node_path_1.default.dirname(destPath);
    // Ensure destination directory exists
    ensureDirectory(destDir);
    // Copy file
    try {
        (0, node_fs_1.copyFileSync)(asset.sourcePath, destPath);
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
function copyAssets(assets, assetsRoot) {
    let copied = 0;
    for (const asset of assets) {
        copyAssetFile(asset, assetsRoot);
        copied++;
    }
    return copied;
}
//# sourceMappingURL=asset-copy.js.map