#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { nativeExecutable, prepareNativeExecutable } from '../lib/native-executable.js';

const require = createRequire(import.meta.url);
const native = nativeExecutable(process.platform, process.arch);
let nativeBinary;
if (native) {
    try {
        const packageJson = require.resolve(`${native.packageName}/package.json`);
        const executablePath = path.join(path.dirname(packageJson), 'bin', native.executableName);
        if (prepareNativeExecutable(executablePath, process.platform)) {
            nativeBinary = executablePath;
        }
    } catch (error) {
        if (error?.code !== 'MODULE_NOT_FOUND') {
            throw error;
        }
    }
}

if (nativeBinary) {
    const result = spawnSync(nativeBinary, process.argv.slice(2), { stdio: 'inherit' });
    if (result.error) {
        throw result.error;
    }
    process.exit(result.status ?? 1);
}

await import('../lib/index.js');
