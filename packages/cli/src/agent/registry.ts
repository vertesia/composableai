import { Command } from "commander";
import { getClient } from "../client.js";
import { resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

const REGISTRY_URI_ABS_PATH = "//us-central1-npm.pkg.dev/dengenlabs/npm/";
function getRegistryLine() {
    return `@dglabs:registry=https:${REGISTRY_URI_ABS_PATH}`;
}
function getRegistryAuthTokenLine(token: string) {
    return `${REGISTRY_URI_ABS_PATH}:_authToken=${token}`;
}

export async function getGoogleToken(program: Command) {
    const client = getClient(program);
    console.log((await client.account.getGoogleToken()).token);
}

export async function getGooglePrincipal(program: Command) {
    const client = getClient(program);
    console.log((await client.account.getGoogleToken()).principal);
}

export async function createOrUpdateNpmRegistry(program: Command, file?: string) {
    const client = getClient(program);
    const gtok = await client.account.getGoogleToken();

    let content = "", resolvedFile: string | undefined;
    if (!file) {
        console.log(getRegistryLine());
        console.log(getRegistryAuthTokenLine(gtok.token));
    } else {
        resolvedFile = resolve(file);
        try {
            content = readFileSync(resolvedFile, "utf-8");
        } catch (err: any) {
            // ignore
        }
        const lines = content.trim().split("\n").filter((line) => !line.includes(REGISTRY_URI_ABS_PATH));

        lines.push(getRegistryLine());
        lines.push(getRegistryAuthTokenLine(gtok.token));
        const out = lines.join('\n') + '\n';

        if (resolvedFile) {
            writeFileSync(resolvedFile, out, "utf8");
        }
    }


}