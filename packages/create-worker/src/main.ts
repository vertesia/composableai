#!/usr/bin/env node

/**
 * @vertesia/create-worker
 *
 * This package has been deprecated in favor of @vertesia/create-plugin.
 * It now acts as a thin wrapper that redirects to create-plugin with the worker template pre-selected.
 */

import { spawn } from 'child_process';

const DEPRECATION_MESSAGE = `
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ⚠️  @vertesia/create-worker is deprecated                                  │
│                                                                             │
│  Please use @vertesia/create-plugin instead:                                │
│                                                                             │
│    pnpm create @vertesia/plugin my-worker                                   │
│    npm create @vertesia/plugin my-worker                                    │
│                                                                             │
│  Then select "Vertesia Workflow Worker" from the template list.             │
│                                                                             │
│  Continuing with legacy behavior for backwards compatibility...             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
`;

async function main(argv: string[]) {
    console.log(DEPRECATION_MESSAGE);

    const projectName = argv[2];

    if (!projectName) {
        console.error('Please specify a project name:');
        console.error('  npx @vertesia/create-worker my-worker');
        process.exit(1);
    }

    // Forward to create-plugin - user will need to select the worker template
    console.log('Launching @vertesia/create-plugin...\n');

    const child = spawn('npx', ['@vertesia/create-plugin', projectName], {
        stdio: 'inherit',
        shell: true
    });

    child.on('close', (code: number | null) => {
        process.exit(code || 0);
    });

    child.on('error', (err: Error) => {
        console.error('Failed to launch create-plugin:', err.message);
        console.error('\nPlease install and run create-plugin directly:');
        console.error(`  npx @vertesia/create-plugin ${projectName}`);
        process.exit(1);
    });
}

main(process.argv).catch(err => {
    console.error("Error: ", err);
    process.exit(1);
});
