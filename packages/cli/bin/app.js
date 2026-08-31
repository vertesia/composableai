#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const macBinary =
    process.platform === 'darwin' && (process.arch === 'arm64' || process.arch === 'x64')
        ? fileURLToPath(new URL(`./vertesia-darwin-${process.arch}`, import.meta.url))
        : undefined;

if (macBinary) {
    const result = spawnSync(macBinary, process.argv.slice(2), { stdio: 'inherit' });
    if (result.error) {
        throw result.error;
    }
    process.exit(result.status ?? 1);
}

await import('../lib/index.js');
