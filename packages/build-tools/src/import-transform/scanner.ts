/**
 * Walks a compiled library directory to find candidate JavaScript files
 * that may contain Vertesia query-style imports (`?skill`, `?raw`, …) or
 * `SKILL.md` imports.
 *
 * Returns absolute paths to `.js` files whose content matches a quick
 * content sniff for any of the trigger tokens, avoiding a re-read in the
 * detector.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { SNIFF_PATTERN } from './patterns.js';

export interface ScannedFile {
    /** Absolute path to the file. */
    path: string;

    /** File content, captured during scanning. */
    content: string;
}

export function scanLibForQueryImports(libDir: string): ScannedFile[] {
    const results: ScannedFile[] = [];
    walk(libDir, results);
    return results;
}

function walk(dir: string, out: ScannedFile[]): void {
    let entries: string[];
    try {
        entries = readdirSync(dir);
    } catch {
        return;
    }

    for (const entry of entries) {
        const full = path.join(dir, entry);
        let stats: ReturnType<typeof statSync>;
        try {
            stats = statSync(full);
        } catch {
            continue;
        }

        if (stats.isDirectory()) {
            walk(full, out);
        } else if (stats.isFile() && full.endsWith('.js')) {
            const content = readFileSync(full, 'utf-8');
            if (SNIFF_PATTERN.test(content)) {
                out.push({ path: full, content });
            }
        }
    }
}
