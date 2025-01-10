import { spawn } from 'child_process';
import enquirer from "enquirer";
import { readFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const { prompt } = enquirer;

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));

let _package: any;
function getPackage() {
    if (_package === undefined) {
        _package = JSON.parse(readFileSync(`${packageDir}/package.json`, 'utf8'));
    }
    return _package;
}
function getVersion() {
    return getPackage().version;
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

export { getLatestVersion, getPackage, getVersion, packageDir, warnIfNotLatest };
