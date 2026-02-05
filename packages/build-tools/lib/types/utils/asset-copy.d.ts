/**
 * Utilities for copying asset files during build
 */
import type { AssetFile } from '../types.js';
/**
 * Copy an asset file to its destination
 *
 * @param asset - Asset file information
 * @param assetsRoot - Root directory for assets
 */
export declare function copyAssetFile(asset: AssetFile, assetsRoot: string): void;
/**
 * Copy multiple asset files
 *
 * @param assets - Array of asset files to copy
 * @param assetsRoot - Root directory for assets
 * @returns Number of files copied
 */
export declare function copyAssets(assets: AssetFile[], assetsRoot: string): number;
//# sourceMappingURL=asset-copy.d.ts.map