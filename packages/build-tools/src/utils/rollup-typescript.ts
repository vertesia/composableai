import type * as ts from 'typescript';

type TypescriptModule = typeof ts;

export interface RollupTypescriptOptions {
    watchMode?: boolean;
}

export function isRollupWatchMode(): boolean {
    return process.env.ROLLUP_WATCH === 'true' || process.argv.includes('--watch') || process.argv.includes('-w');
}

export function createRollupTypescript(
    typescript: TypescriptModule,
    options: RollupTypescriptOptions = {}
): TypescriptModule {
    if (options.watchMode ?? isRollupWatchMode()) {
        return typescript;
    }

    // @rollup/plugin-typescript creates a TypeScript watch program even for one-shot builds.
    // No-op TS watchers here so Rollup can exit cleanly after writing output files.
    const nonWatchingTypescript = Object.create(typescript) as TypescriptModule;
    Object.defineProperty(nonWatchingTypescript, 'sys', {
        enumerable: true,
        value: {
            ...typescript.sys,
            watchFile() {
                return { close() {} };
            },
            watchDirectory() {
                return { close() {} };
            },
        },
    });
    return nonWatchingTypescript;
}
