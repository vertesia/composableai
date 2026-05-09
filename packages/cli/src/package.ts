import { spawn } from 'child_process';
import enquirer from "enquirer";
import { readFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const { prompt } = enquirer;

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));

interface PackageMetadata {
    name: string;
    version: string;
}

interface RuntimeMetadata {
    name: 'bun' | 'node';
    version?: string;
    platform: NodeJS.Platform;
    arch: string;
}

interface BunRuntime {
    version?: string;
}

const fallbackPackage: PackageMetadata = {
    name: process.env.VERTESIA_CLI_BUILD_NAME || '@vertesia/cli',
    version: process.env.VERTESIA_CLI_BUILD_VERSION || '0.0.0',
};

let _package: PackageMetadata | undefined;
function getPackage(): PackageMetadata {
    if (_package === undefined) {
        _package = readPackageFile() ?? fallbackPackage;
    }
    return _package;
}

function readPackageFile(): PackageMetadata | undefined {
    try {
        const parsed: unknown = JSON.parse(readFileSync(`${packageDir}/package.json`, 'utf8'));
        if (!isPackageMetadata(parsed)) {
            throw new Error('Invalid package metadata.');
        }
        return parsed;
    } catch (error: unknown) {
        if (isFileNotFoundError(error)) {
            return undefined;
        }
        throw error;
    }
}

function isPackageMetadata(value: unknown): value is PackageMetadata {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const name = Reflect.get(value, 'name');
    const version = Reflect.get(value, 'version');
    return typeof name === 'string' && typeof version === 'string';
}

function isFileNotFoundError(error: unknown): boolean {
    return error instanceof Error
        && 'code' in error
        && Reflect.get(error, 'code') === 'ENOENT';
}

function getVersion(): string {
    return getPackage().version;
}

function getRuntimeMetadata(): RuntimeMetadata {
    const bun = Reflect.get(globalThis, 'Bun') as BunRuntime | undefined;
    if (bun) {
        return {
            name: 'bun',
            version: bun.version,
            platform: process.platform,
            arch: process.arch,
        };
    }
    return {
        name: 'node',
        version: process.versions.node,
        platform: process.platform,
        arch: process.arch,
    };
}

function getVersionLabel(): string {
    const runtime = getRuntimeMetadata();
    const runtimeVersion = runtime.version ? ` ${runtime.version}` : '';
    return `${getVersion()} (${runtime.name}${runtimeVersion}, ${runtime.platform}-${runtime.arch})`;
}

async function getLatestVersion() {
    const { name } = getPackage();
    const { version } = await fetch(`https://registry.npmjs.org/${name}/latest`,
        { signal: AbortSignal.timeout(900) })
        .then(res => res.json())
        .catch(() => undefined);
    return version;
}

export async function upgrade(yes: boolean) {
    const { version } = getPackage();
    const latestVersion = await getLatestVersion();
    if (latestVersion && version !== latestVersion) {
        let doUpgrade = false;
        if (!yes) {
            console.log('There is a new version available (v' + latestVersion + ').');
            const answer: any = await prompt({
                name: 'upgrade',
                type: 'confirm',
                message: "Would you like to upgrade?",
                initial: true,
            });
            if (answer.upgrade) {
                doUpgrade = true;
            }
        } else {
            doUpgrade = true;
        }
        if (doUpgrade) {
            spawn("npm", ["update", "-g", getPackage().name], {
                stdio: 'inherit',
            });
        }
    } else {
        console.log('No updates are available.');
    }
}

async function warnIfNotLatest() {
    const { version } = getPackage();
    const latestVersion = await getLatestVersion();
    if (latestVersion && version !== latestVersion) {
        console.warn(`WARNING: You are using version ${version} of this package, but the latest version is ${latestVersion}.\nYou should update with \`npm i -g ${getPackage().name}\`\n`);
    }
}

export { getLatestVersion, getPackage, getRuntimeMetadata, getVersion, getVersionLabel, packageDir, warnIfNotLatest };
