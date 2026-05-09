#!/usr/bin/env node
import { chmodSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const cliDir = resolve(scriptDir, '..');
const repoRoot = resolve(cliDir, '..', '..');
const defaultOutfile = resolve(repoRoot, 'packages/cli-darwin-arm64/bin/vertesia');
const outfile = resolve(process.env.VERTESIA_CLI_BINARY_OUT || defaultOutfile);
const targetPlatform = process.env.VERTESIA_CLI_NATIVE_PLATFORM || 'darwin';
const targetArch = process.env.VERTESIA_CLI_NATIVE_ARCH || 'arm64';
const bunTarget = process.env.VERTESIA_CLI_BUN_TARGET || `bun-${targetPlatform}-${targetArch}`;
const requireBinary = process.env.VERTESIA_CLI_REQUIRE_NATIVE_BINARY === '1';
const hostMatchesTarget = process.platform === targetPlatform && process.arch === targetArch;
const packageJson = JSON.parse(readFileSync(resolve(cliDir, 'package.json'), 'utf8'));

if (!hostMatchesTarget && process.env.VERTESIA_CLI_CROSS_COMPILE !== '1') {
    if (existsSync(outfile)) {
        console.log(`Native CLI binary already exists: ${outfile}`);
        process.exit(0);
    }
    if (requireBinary) {
        console.error(`Missing required native CLI binary: ${outfile}`);
        process.exit(1);
    }
    console.log(`Skipping native CLI binary build on ${process.platform}-${process.arch}.`);
    process.exit(0);
}

mkdirSync(dirname(outfile), { recursive: true });

run('bun', [
    'build',
    'src/index.ts',
    '--compile',
    '--no-compile-autoload-dotenv',
    `--target=${bunTarget}`,
    '--env=VERTESIA_CLI_BUILD_*',
    '--outfile',
    outfile,
], {
    cwd: cliDir,
    env: {
        ...process.env,
        VERTESIA_CLI_BUILD_NAME: packageJson.name,
        VERTESIA_CLI_BUILD_VERSION: packageJson.version,
    },
});

chmodSync(outfile, 0o755);

if (targetPlatform === 'darwin' && process.env.VERTESIA_CLI_CODESIGN !== '0') {
    const identity = process.env.VERTESIA_CLI_CODESIGN_IDENTITY
        || process.env.APPLE_CODESIGN_IDENTITY
        || process.env.CODESIGN_IDENTITY
        || '-';
    const identifier = process.env.VERTESIA_CLI_CODESIGN_IDENTIFIER || 'com.vertesia.cli';
    const args = ['--force', '--sign', identity, '--identifier', identifier];
    if (identity !== '-') {
        args.push('--timestamp', '--options', 'runtime');
    }
    if (process.env.VERTESIA_CLI_CODESIGN_ENTITLEMENTS) {
        args.push('--entitlements', process.env.VERTESIA_CLI_CODESIGN_ENTITLEMENTS);
    }
    args.push(outfile);
    run('codesign', args);
}

console.log(`Built native CLI binary: ${outfile}`);

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        stdio: 'inherit',
        ...options,
    });
    if (result.error) {
        console.error(result.error.message);
        process.exit(1);
    }
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}
