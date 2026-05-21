import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Plugin } from 'rolldown';

export interface TypeScriptTypecheckPluginOptions {
    /**
     * Path to the TypeScript project file, relative to the current package.
     */
    tsconfig?: string;

    /**
     * TypeScript emit mode for the checker.
     * - `noEmit`: validate types only.
     * - `emitDeclarationOnly`: validate types and emit declaration files.
     */
    mode?: 'noEmit' | 'emitDeclarationOnly';

    /**
     * Working directory for the `tsc` process.
     */
    cwd?: string;

    /**
     * Additional arguments passed to `tsc`.
     */
    extraArgs?: string[];
}

export function typescriptTypecheckPlugin(options: TypeScriptTypecheckPluginOptions = {}): Plugin {
    const tsconfig = options.tsconfig ?? './tsconfig.json';
    const mode = options.mode ?? 'noEmit';
    const cwd = options.cwd ?? process.cwd();
    let checked = false;

    function runTypeScript(this: { error(message: string): never }) {
        if (checked) {
            return;
        }
        checked = true;

        const requireFromCwd = createRequire(path.resolve(cwd, 'package.json'));
        const tscBin = requireFromCwd.resolve('typescript/bin/tsc');
        const modeArgs = mode === 'emitDeclarationOnly' ? ['--emitDeclarationOnly'] : ['--noEmit'];
        const args = [tscBin, '-p', tsconfig, ...modeArgs, ...(options.extraArgs ?? [])];
        const result = spawnSync(process.execPath, args, {
            cwd,
            env: process.env,
            stdio: 'inherit',
        });

        if (result.error) {
            this.error(`TypeScript check failed to start: ${result.error.message}`);
        }
        if (result.status !== 0) {
            this.error(`TypeScript check failed for ${tsconfig}`);
        }
    }

    return {
        name: 'typescript-typecheck',
        buildStart() {
            runTypeScript.call(this);
        },
        watchChange() {
            checked = false;
        },
    };
}
