"use strict";
/**
 * Utilities for discovering asset files (scripts, widgets) in skill directories
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverSkillAssets = discoverSkillAssets;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
/**
 * Check if a file exists and is a regular file
 */
function isFile(filePath) {
    try {
        return (0, node_fs_1.statSync)(filePath).isFile();
    }
    catch {
        return false;
    }
}
/**
 * Get all files in a directory (non-recursive)
 */
function getFilesInDirectory(dirPath) {
    try {
        return (0, node_fs_1.readdirSync)(dirPath).filter(file => {
            const fullPath = node_path_1.default.join(dirPath, file);
            return isFile(fullPath);
        });
    }
    catch {
        return [];
    }
}
/**
 * Check if a file is a script file (.js or .py)
 */
function isScriptFile(fileName) {
    return /\.(js|py)$/.test(fileName);
}
/**
 * Check if a file is a widget file (.tsx)
 */
function isWidgetFile(fileName) {
    return /\.tsx$/.test(fileName);
}
/**
 * Extract widget name from .tsx file (remove extension)
 */
function getWidgetName(fileName) {
    return fileName.replace(/\.tsx$/, '');
}
/**
 * Discover assets (scripts and widgets) in a skill directory
 *
 * @param skillFilePath - Absolute path to the skill.md file
 * @param options - Asset discovery options
 * @returns Discovered assets and metadata
 */
function discoverSkillAssets(skillFilePath, options = {}) {
    const skillDir = node_path_1.default.dirname(skillFilePath);
    const files = getFilesInDirectory(skillDir);
    const scripts = [];
    const widgets = [];
    const widgetMetadata = [];
    const assetFiles = [];
    const scriptsDir = options.scriptsDir || 'scripts';
    for (const file of files) {
        const fullPath = node_path_1.default.join(skillDir, file);
        if (isScriptFile(file)) {
            // Script file (.js or .py)
            scripts.push(file);
            assetFiles.push({
                sourcePath: fullPath,
                destPath: node_path_1.default.join(scriptsDir, file),
                type: 'script'
            });
        }
        else if (isWidgetFile(file)) {
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
//# sourceMappingURL=asset-discovery.js.map