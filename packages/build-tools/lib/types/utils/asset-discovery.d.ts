/**
 * Utilities for discovering asset files (scripts, widgets) in skill directories
 */
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
 * Discover assets (scripts and widgets) in a skill directory
 *
 * @param skillFilePath - Absolute path to the skill.md file
 * @param options - Asset discovery options
 * @returns Discovered assets and metadata
 */
export declare function discoverSkillAssets(skillFilePath: string, options?: {
    scriptsDir?: string;
    widgetsDir?: string;
}): DiscoveredAssets;
//# sourceMappingURL=asset-discovery.d.ts.map