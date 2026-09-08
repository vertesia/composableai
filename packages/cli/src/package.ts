import { spawn } from 'node:child_process';
import enquirer from 'enquirer';
import packageMetadata from '../package.json' with { type: 'json' };
import { getBooleanOption, getStringOption, isRecord } from './utils/options.js';

const { prompt } = enquirer;

declare const VERTESIA_CLI_RUNTIME: string | undefined;

interface PackageMetadata {
    name: string;
    version: string;
}

let _package: PackageMetadata | undefined;
function getPackage(): PackageMetadata {
    if (_package === undefined) {
        _package = readPackageMetadata(packageMetadata);
    }
    return _package;
}
function getVersion() {
    const runtime = typeof VERTESIA_CLI_RUNTIME === 'string' ? VERTESIA_CLI_RUNTIME : 'javascript';
    return `${getPackage().version} (${runtime})`;
}

async function getLatestVersion() {
    const { name } = getPackage();
    const response = await fetch(`https://registry.npmjs.org/${name}/latest`, { signal: AbortSignal.timeout(900) })
        .then((res) => res.json())
        .catch(() => undefined);
    return isRecord(response) ? getStringOption(response.version) : undefined;
}

export async function upgrade(yes: boolean) {
    const { version } = getPackage();
    const latestVersion = await getLatestVersion();
    if (latestVersion && version !== latestVersion) {
        let doUpgrade = false;
        if (!yes) {
            console.log(`There is a new version available (v${latestVersion}).`);
            const answer = await prompt<{ upgrade?: boolean }>({
                name: 'upgrade',
                type: 'confirm',
                message: 'Would you like to upgrade?',
                initial: true,
            });
            if (getBooleanOption(answer.upgrade)) {
                doUpgrade = true;
            }
        } else {
            doUpgrade = true;
        }
        if (doUpgrade) {
            spawn('npm', ['update', '-g', getPackage().name], {
                stdio: 'inherit',
            });
        }
    } else {
        console.log('No updates are available.');
    }
}

function readPackageMetadata(value: unknown): PackageMetadata {
    if (!isRecord(value)) {
        throw new Error('Invalid package metadata');
    }
    const name = getStringOption(value.name);
    const version = getStringOption(value.version);
    if (!name || !version) {
        throw new Error('Invalid package metadata');
    }
    return { name, version };
}

async function warnIfNotLatest() {
    const { version } = getPackage();
    const latestVersion = await getLatestVersion();
    if (latestVersion && version !== latestVersion) {
        console.warn(
            `WARNING: You are using version ${version} of this package, but the latest version is ${latestVersion}.\nYou should update with \`npm i -g ${getPackage().name}\`\n`,
        );
    }
}

export { getLatestVersion, getPackage, getVersion, warnIfNotLatest };
