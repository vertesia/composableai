#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { chmodSync } from 'node:fs';

const require = createRequire(import.meta.url);

const nativePackage = getNativePackageName();
if (nativePackage && process.env.VERTESIA_CLI_DISABLE_NATIVE !== '1') {
    const nativeBin = resolveNativeBinary(nativePackage);
    if (nativeBin) {
        ensureExecutable(nativeBin);
        const result = spawnSync(nativeBin, process.argv.slice(2), {
            stdio: 'inherit',
            env: process.env,
        });
        if (result.error) {
            console.error(result.error.message);
            process.exit(1);
        }
        if (result.signal) {
            process.kill(process.pid, result.signal);
        }
        process.exit(result.status ?? 1);
    }
}

await import('../lib/index.js');

function getNativePackageName() {
    if (process.platform === 'darwin' && process.arch === 'arm64') {
        return '@vertesia/cli-darwin-arm64';
    }
    return undefined;
}

function resolveNativeBinary(packageName) {
    try {
        return require.resolve(`${packageName}/bin/vertesia`);
    } catch {
        return undefined;
    }
}

function ensureExecutable(file) {
    try {
        chmodSync(file, 0o755);
    } catch {
        // npm normally preserves executable mode for bin entries. If this fails,
        // spawnSync will report the real execution error below.
    }
}
