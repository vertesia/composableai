import { spawnSync } from 'node:child_process';
import {
    accessSync,
    constants,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    renameSync,
    rmSync,
    statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cliDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(cliDirectory, '../..');
if (process.platform !== 'darwin' || !['arm64', 'x64'].includes(process.arch)) {
    throw new Error(
        `The native CLI package smoke test requires macOS arm64 or x64, got ${process.platform} ${process.arch}`,
    );
}

const nativePackageDirectory = path.join(repositoryRoot, 'packages', `cli-darwin-${process.arch}`);
const cliPackageSpec = process.env.CLI_PACKAGE_SPEC;
const registryUrl = process.env.CLI_REGISTRY_URL ?? 'https://registry.npmjs.org';
const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'vertesia-cli-smoke-'));
const installDirectory = path.join(temporaryDirectory, 'install');
const npmCacheDirectory = path.join(temporaryDirectory, 'npm-cache');
const pnpm = 'pnpm';
const npm = 'npm';

function run(command, args, options = {}) {
    const result = spawnSync(command, args, { stdio: 'inherit', ...options });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`${command} exited with status ${result.status}`);
    }
}

function runAndCapture(command, args) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        process.stderr.write(result.stderr);
        throw new Error(`${command} exited with status ${result.status}`);
    }
    process.stdout.write(result.stdout);
    return result.stdout.trim();
}

try {
    mkdirSync(installDirectory);
    if (cliPackageSpec) {
        run(npm, [
            'install',
            '--prefix',
            installDirectory,
            '--cache',
            npmCacheDirectory,
            '--include=optional',
            '--registry',
            registryUrl,
            cliPackageSpec,
        ]);
    } else {
        run(pnpm, ['pack', '--pack-destination', temporaryDirectory], { cwd: nativePackageDirectory });
        run(pnpm, ['pack', '--pack-destination', temporaryDirectory], { cwd: cliDirectory });

        const tarballs = readdirSync(temporaryDirectory)
            .filter((file) => file.endsWith('.tgz'))
            .map((file) => path.join(temporaryDirectory, file));
        if (tarballs.length !== 2) {
            throw new Error(`Expected two package tarballs, found ${tarballs.length}`);
        }
        run(npm, [
            'install',
            '--prefix',
            installDirectory,
            '--cache',
            npmCacheDirectory,
            '--omit=optional',
            ...tarballs,
        ]);
    }

    const installedScope = path.join(installDirectory, 'node_modules', '@vertesia');
    const installedNativePackages = readdirSync(installedScope).filter((name) => /^cli-darwin-/.test(name));
    const expectedNativePackage = `cli-darwin-${process.arch}`;
    if (installedNativePackages.length !== 1 || installedNativePackages[0] !== expectedNativePackage) {
        throw new Error(
            `Expected only ${expectedNativePackage}, found ${installedNativePackages.join(', ') || 'no native package'}`,
        );
    }

    const executable = path.join(installDirectory, 'node_modules', '.bin', 'vertesia');
    const nativeExecutable = path.join(installedScope, expectedNativePackage, 'bin', 'vertesia');
    if ((statSync(nativeExecutable).mode & 0o111) === 0) {
        throw new Error(`Packed native executable is not executable: ${nativeExecutable}`);
    }
    accessSync(nativeExecutable, constants.X_OK);
    if (process.env.CLI_VERIFY_CODE_SIGNATURE === 'true') {
        run('codesign', ['--verify', '--strict', '--verbose=2', nativeExecutable]);
    }

    const expectedVersion =
        process.env.CLI_VERSION ?? JSON.parse(readFileSync(path.join(cliDirectory, 'package.json'), 'utf8')).version;
    const actualNativeVersion = runAndCapture(nativeExecutable, ['--version']);
    if (actualNativeVersion !== expectedVersion) {
        throw new Error(`Expected native CLI version ${expectedVersion}, got ${actualNativeVersion}`);
    }

    renameSync(
        path.join(installedScope, 'cli', 'lib', 'index.js'),
        path.join(installedScope, 'cli', 'lib', 'index.js.disabled'),
    );
    const actualVersion = runAndCapture(executable, ['--version']);
    if (actualVersion !== expectedVersion) {
        throw new Error(`Expected CLI version ${expectedVersion}, got ${actualVersion}`);
    }
} finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
}
