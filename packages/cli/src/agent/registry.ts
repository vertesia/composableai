import { Command } from "commander";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getClient } from "../client.js";
import { config } from "../profiles/index.js";


const REGISTRY_URI_ABS_PATH = "//us-central1-npm.pkg.dev/dengenlabs/npm/";
function getRegistryLine() {
    return `@dglabs:registry=https:${REGISTRY_URI_ABS_PATH}`;
}
function getRegistryAuthTokenLine(token: string) {
    return `${REGISTRY_URI_ABS_PATH}:_authToken=${token}`;
}

export async function getGoogleToken(program: Command, profileName?: string) {
    if (profileName) {
        config.use(profileName);
    }
    const client = getClient(program);
    console.log((await client.account.getGoogleToken()).token);
}

export async function getGooglePrincipal(program: Command, profileName?: string) {
    if (profileName) {
        config.use(profileName);
    }
    const client = getClient(program);
    console.log((await client.account.getGoogleToken()).principal);
}

export async function createOrUpdateNpmRegistry(program: Command, npmrcFile: string) {
    const client = getClient(program);
    const gtok = await client.account.getGoogleToken();

    npmrcFile = resolve(npmrcFile);

    let content = "";

    try {
        content = readFileSync(npmrcFile, "utf-8");
    } catch (err: any) {
        // ignore
    }
    const lines = content.trim().split("\n").filter((line) => !line.includes(REGISTRY_URI_ABS_PATH));

    lines.push(getRegistryLine());
    lines.push(getRegistryAuthTokenLine(gtok.token));
    const out = lines.join('\n') + '\n';

    writeFileSync(npmrcFile, out, "utf8");

}
