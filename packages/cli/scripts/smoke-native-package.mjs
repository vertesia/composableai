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
const nativePlatform = process.platform === 'darwin' && ['arm64', 'x64'].includes(process.arch);
const cliPackageSpec = process.env.CLI_PACKAGE_SPEC;
const nativePackageOnly = process.env.CLI_NATIVE_PACKAGE_ONLY === 'true';
if (!nativePlatform && (!cliPackageSpec || nativePackageOnly)) {
    throw new Error(
        `The packed native CLI smoke test requires macOS arm64 or x64, got ${process.platform} ${process.arch}`,
    );
}

const nativePackageDirectory = nativePlatform
    ? path.join(repositoryRoot, 'packages', `cli-darwin-${process.arch}`)
    : undefined;
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
        const installArgs = [
            'install',
            '--prefix',
            installDirectory,
            '--cache',
            npmCacheDirectory,
            '--include=optional',
            '--registry',
            registryUrl,
            cliPackageSpec,
        ];
        console.log(`Installing CLI from registry with command:\n${npm} ${installArgs.join(' ')}`);
        run(npm, installArgs);
    } else {
        if (!nativePackageDirectory) {
            throw new Error('Native package directory is unavailable');
        }
        run(pnpm, ['pack', '--pack-destination', temporaryDirectory], { cwd: nativePackageDirectory });
        if (!nativePackageOnly) {
            run(pnpm, ['pack', '--pack-destination', temporaryDirectory], { cwd: cliDirectory });
        }

        const tarballs = readdirSync(temporaryDirectory)
            .filter((file) => file.endsWith('.tgz'))
            .map((file) => path.join(temporaryDirectory, file));
        const expectedTarballCount = nativePackageOnly ? 1 : 2;
        if (tarballs.length !== expectedTarballCount) {
            throw new Error(`Expected ${expectedTarballCount} package tarballs, found ${tarballs.length}`);
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
    const executable = path.join(installDirectory, 'node_modules', '.bin', 'vertesia');
    const expectedVersion =
        process.env.CLI_VERSION ?? JSON.parse(readFileSync(path.join(cliDirectory, 'package.json'), 'utf8')).version;

    if (!nativePlatform) {
        if (installedNativePackages.length !== 0) {
            throw new Error(`Expected no native package, found ${installedNativePackages.join(', ')}`);
        }
        console.log('Verified that no macOS native package was installed');
        console.log(`Executing JavaScript fallback: ${executable} --version`);
        const actualVersion = runAndCapture(executable, ['--version']);
        const expectedJavaScriptVersion = `${expectedVersion} (javascript)`;
        if (actualVersion !== expectedJavaScriptVersion) {
            throw new Error(`Expected CLI version ${expectedJavaScriptVersion}, got ${actualVersion}`);
        }
    } else {
        const expectedNativePackage = `cli-darwin-${process.arch}`;
        if (installedNativePackages.length !== 1 || installedNativePackages[0] !== expectedNativePackage) {
            throw new Error(
                `Expected only ${expectedNativePackage}, found ${installedNativePackages.join(', ') || 'no native package'}`,
            );
        }
        console.log(`Verified native package selection: @vertesia/${expectedNativePackage}`);

        const nativeExecutable = path.join(installedScope, expectedNativePackage, 'bin', 'vertesia');
        if ((statSync(nativeExecutable).mode & 0o111) === 0) {
            throw new Error(`Packed native executable is not executable: ${nativeExecutable}`);
        }
        accessSync(nativeExecutable, constants.X_OK);
        console.log(`Verified native executable permission: ${nativeExecutable}`);
        if (process.env.CLI_VERIFY_CODE_SIGNATURE === 'true') {
            console.log(`Verifying native code signature: ${nativeExecutable}`);
            run('codesign', ['--verify', '--strict', '--verbose=2', nativeExecutable]);
        }

        console.log(`Executing native package binary: ${nativeExecutable} --version`);
        const actualNativeVersion = runAndCapture(nativeExecutable, ['--version']);
        const expectedNativeVersion = `${expectedVersion} (native darwin-${process.arch})`;
        if (actualNativeVersion !== expectedNativeVersion) {
            throw new Error(`Expected native CLI version ${expectedNativeVersion}, got ${actualNativeVersion}`);
        }

        if (!nativePackageOnly) {
            console.log(
                'Disabling the JavaScript fallback to prove that the installed launcher uses the native binary',
            );
            renameSync(
                path.join(installedScope, 'cli', 'lib', 'index.js'),
                path.join(installedScope, 'cli', 'lib', 'index.js.disabled'),
            );
            console.log(`Executing installed CLI launcher: ${executable} --version`);
            const actualVersion = runAndCapture(executable, ['--version']);
            if (actualVersion !== expectedNativeVersion) {
                throw new Error(`Expected CLI version ${expectedNativeVersion}, got ${actualVersion}`);
            }
        }
    }
} finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
}
