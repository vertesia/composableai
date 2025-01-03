import enquirer from "enquirer";
import { basename, resolve } from "node:path";
import { chdir } from "node:process";
import { fileURLToPath } from "node:url";
import { copyTree } from "./copy.js";
import { installDeps, installPrivateDeps } from "./deps.js";
import { gcloudAuth, registryAuth } from "./gcloud.js";
import { Package } from "./Package.js";
import { processAndRenameTemplateFile } from "./template.js";
import { hasBin } from "./hasBin.js";
import { mkdirSync } from "node:fs";

const { prompt } = enquirer;

export async function init(pm: string, dirName?: string | undefined) {

    const hasPnpm = pm === "pnpm" || await hasBin("pnpm");

    await gcloudAuth();

    let dir: string;
    if (!dirName) {
        dir = process.cwd();
        dirName = basename(dir);
    } else {
        dir = resolve(dirName);
        mkdirSync(dir, { recursive: true });
        chdir(dir);
    }

    // copy template to current directory
    const templDir = resolve(fileURLToPath(import.meta.url), '../../template');
    copyTree(templDir, dir);

    const answer: any = await prompt([{
        name: 'pm',
        type: 'select',
        message: "Which package manager to use?",
        initial: hasPnpm ? 1 : 0,
        choices: ["npm", "pnpm"],
    }, {
        name: 'name',
        type: 'input',
        message: "Package name",
        initial: dirName,
    }, {
        name: 'version',
        type: 'input',
        initial: '1.0.0',
        message: "Package version",
    }, {
        name: 'description',
        type: 'input',
        required: false,
        initial: '',
        message: "Description",
    }]);

    const cmd = answer.pm || "npm";

    const pkg = new Package({
        name: answer.name,
        version: answer.version || '1.0.0',
        description: answer.description || '',
        type: 'module',
        main: 'lib/index.js',
        types: 'lib/index.d.ts',
        scripts: {
            "build": "tsc --build && node ./bin/bundle-workflows.mjs lib/esm/workflows.js lib/workflows-bundle.js",
            "clean": `rimraf ./lib tsconfig.tsbuildinfo`,
            "dev": "node lib/main.js",
            "registry-auth": `artifactregistry-auth`
        },
    });

    pkg.saveTo(`${dir}/package.json`);

    console.log("Generating .env file");
    processAndRenameTemplateFile(`${dir}/.env.template`, { name: pkg.name });

    installDeps(cmd);

    registryAuth(cmd);

    installPrivateDeps(cmd);
}
