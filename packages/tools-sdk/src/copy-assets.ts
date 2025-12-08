#!/usr/bin/env node
/**
 * Copy runtime assets (skill files, prompt files, scripts) to dist folder
 * These files are read from disk at runtime and need to be deployed with the app
 *
 * Usage:
 *   npx tools-sdk-copy-assets [srcDir] [distDir]
 *
 * Or import and call directly:
 *   import { copyRuntimeAssets } from '@vertesia/tools-sdk';
 *   copyRuntimeAssets('./src', './dist');
 */
import { existsSync, readdirSync, statSync, mkdirSync, copyFileSync } from "fs";
import { dirname, join } from "path";

/**
 * Recursively copy files matching a filter
 */
function copyFilesRecursive(src: string, dest: string, fileFilter: (filename: string) => boolean): void {
    if (!existsSync(src)) return;

    const entries = readdirSync(src);

    for (const entry of entries) {
        const srcPath = join(src, entry);
        const destPath = join(dest, entry);
        const stat = statSync(srcPath);

        if (stat.isDirectory()) {
            // Recurse into directories
            copyFilesRecursive(srcPath, destPath, fileFilter);
        } else if (fileFilter(entry)) {
            // Copy matching files
            mkdirSync(dirname(destPath), { recursive: true });
            copyFileSync(srcPath, destPath);
        }
    }
}

export interface CopyAssetsOptions {
    /** Source directory (default: './src') */
    srcDir?: string;
    /** Destination directory (default: './dist') */
    distDir?: string;
    /** Whether to log progress (default: true) */
    verbose?: boolean;
}

/**
 * Copy runtime assets (skills, interactions) from src to dist
 */
export function copyRuntimeAssets(options: CopyAssetsOptions = {}): void {
    const {
        srcDir = './src',
        distDir = './dist',
        verbose = true
    } = options;

    if (verbose) {
        console.log('Copying runtime assets to dist...');
    }

    // Copy skill files (SKILL.md, SKILL.jst, *.py)
    const skillsSrc = join(srcDir, 'skills');
    const skillsDest = join(distDir, 'skills');

    if (existsSync(skillsSrc)) {
        copyFilesRecursive(skillsSrc, skillsDest, (filename) => {
            return filename === 'SKILL.md' ||
                   filename === 'SKILL.jst' ||
                   filename.endsWith('.py');
        });
        if (verbose) {
            console.log('  ✓ Skills assets (SKILL.md, SKILL.jst, *.py)');
        }
    }

    // Copy interaction prompt files (prompt.jst, prompt.md)
    const interactionsSrc = join(srcDir, 'interactions');
    const interactionsDest = join(distDir, 'interactions');

    if (existsSync(interactionsSrc)) {
        copyFilesRecursive(interactionsSrc, interactionsDest, (filename) => {
            return filename === 'prompt.jst' ||
                   filename === 'prompt.md';
        });
        if (verbose) {
            console.log('  ✓ Interaction assets (prompt.jst, prompt.md)');
        }
    }

    if (verbose) {
        console.log('Runtime assets copied successfully!');
    }
}

// CLI entry point
if (typeof process !== 'undefined' && process.argv[1]?.includes('copy-assets')) {
    const args = process.argv.slice(2);
    const srcDir = args[0] || './src';
    const distDir = args[1] || './dist';

    copyRuntimeAssets({ srcDir, distDir });
}
