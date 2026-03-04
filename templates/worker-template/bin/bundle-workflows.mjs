#!/usr/bin/env node

import { bundleWorkflowCode } from '@temporalio/worker';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

async function bundle(wsPath, bundlePath) {
    const { code } = await bundleWorkflowCode({
        workflowsPath: path.resolve(wsPath),
        webpackConfigHook: (config) => {
            // Fix for Temporal's VM sandbox environment:
            // 1. publicPath: '' - disable auto-detection (no document.currentScript)
            // 2. chunkLoading: 'import' - use import() instead of JSONP (no 'self' global)
            // 3. globalObject: 'globalThis' - use globalThis instead of self/window
            config.output = {
                ...config.output,
                publicPath: '',
                chunkLoading: 'import',
                globalObject: 'globalThis',
            };
            return config;
        },
    });
    const codePath = path.resolve(bundlePath);
    await writeFile(codePath, code);
    console.log(`Bundle written to ${codePath}`);
}

const wsPath = process.argv[2];
const bundlePath = process.argv[3];
if (!wsPath || !bundlePath) {
    console.error('Usage: build-workflows <workflows-path> <bundle-path>');
    process.exit(1);
}

bundle(wsPath, bundlePath).catch((err) => {
    console.error(err);
    process.exit(1);
});
