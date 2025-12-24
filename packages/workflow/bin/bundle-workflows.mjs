#!/usr/bin/env node

import { bundleWorkflowCode } from '@temporalio/worker';
import { writeFile } from 'fs/promises';
import path from 'path';

async function bundle(wsPath, bundlePath) {
    const { code } = await bundleWorkflowCode({
        workflowsPath: path.resolve(wsPath),
        webpackConfigHook: (config) => {
            // Fix for "Automatic publicPath is not supported in this browser"
            // Temporal workflows run in an isolated VM, not a browser, so auto-detection fails
            config.output = {
                ...config.output,
                publicPath: '',
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
