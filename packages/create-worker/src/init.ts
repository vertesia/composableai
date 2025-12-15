import enquirer from "enquirer";
import { mkdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { chdir } from "node:process";
import { fileURLToPath } from "node:url";
import { connectToVertesia, installOrUpdateCli, VERTESIA_CLI } from "./cli.js";
import { copyTree } from "./copy.js";
import { installDeps } from "./deps.js";
import { hasBin } from "./hasBin.js";
import { Package } from "./Package.js";
import { processAndRenameTemplateFile, processVarsInFile } from "./template.js";

const { prompt } = enquirer;

export async function init(dirName?: string | undefined) {

    const isDockerInstalled = await hasBin("docker");
    if (!isDockerInstalled) {
        console.warn("Docker is not installed. You must install docker if you need to publish your worker.");
    }

    let initialPm = "npm";
    const currentPmPath = process.env.npm_execpath;
    if (!currentPmPath) {
        initialPm = await hasBin("pnpm") ? "pnpm" : "npm";
    } else if (currentPmPath.endsWith("pnpm")) {
        initialPm = "pnpm";
    } else if (currentPmPath.endsWith("yarn")) {
        initialPm = "yarn";
    }

    let dir: string;
    if (!dirName) {
        dir = process.cwd();
        dirName = basename(dir);
    } else {
        dir = resolve(dirName);
        mkdirSync(dir, { recursive: true });
        chdir(dir);
    }

    const pms = ["npm", "pnpm", "yarn"];
    const answer: any = await prompt([{
        name: 'pm',
        type: 'select',
        message: "Which package manager to use?",
        initial: pms.indexOf(initialPm),
        choices: pms,
    }, {
        name: 'worker_org',
        type: 'input',
        message: "Organization name (e.g. mycompany)",
        validate: (input: string) => /[a-zA-Z_][a-zA-Z_0-9-]/g.test(input),
    }, {
        name: 'worker_name',
        type: 'input',
        message: "Worker name (e.g. my-worker)",
        initial: dirName,
        validate: (input: string) => /[a-zA-Z_][a-zA-Z_0-9-]/g.test(input),
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

    const cmd = answer.pm;

    // copy template to current directory
    const templateDirectory = resolve(fileURLToPath(import.meta.url), '../../template');
    await copyTree(templateDirectory, dir);

    console.log("Generating package.json");
    const pkg = new Package({
        name: '@' + answer.worker_org + '/' + answer.worker_name,
        version: answer.version || '1.0.0',
        description: answer.description || '',
        type: 'module',
        main: 'lib/index.js',
        types: 'lib/index.d.ts',
        scripts: {
            "clean": "rimraf ./lib tsconfig.tsbuildinfo",
            "build": "${npm_package_vertesia_pm} run clean && tsc --build && node ./bin/bundle-workflows.mjs lib/workflows.js lib/workflows-bundle.js",
            "typecheck:test": "tsc --project tsconfig.test.json",
            "pretest": "${npm_package_vertesia_pm} run typecheck:test",
            "test": "vitest",
            "start": "node lib/main.js",
            "connect": `${VERTESIA_CLI} worker connect`,
        },
        dependencies: {
            "@dglabs/worker": "^0.11.0",
            "@temporalio/activity": "^1.13.0",
            "@temporalio/client": "^1.13.0",
            "@temporalio/worker": "^1.13.0",
            "@temporalio/workflow": "^1.13.0",
            "@vertesia/client": "^0.78.0",
            "@vertesia/common": "^0.78.0",
            "@vertesia/workflow": "^0.78.0",
        },
        devDependencies: {
            "@temporalio/testing": "^1.13.0",
            "@types/node": "^22.5.0",
            "rimraf": "^6.0.1",
            "typescript": "^5.7.2",
            "vitest": "^3.2.4",
        },
        vertesia: {
            pm: cmd,
            image: {
                repository: "us-docker.pkg.dev/dengenlabs/us.gcr.io",
                organization: answer.worker_org,
                name: answer.worker_name,
            }
        }
    });

    pkg.saveTo(`${dir}/package.json`);

    const service_name = answer.worker_org + '_' + answer.worker_name;
    console.log("Generating .env file");
    processAndRenameTemplateFile(`${dir}/.env.template`, {
        service_name
    });
    console.log("Generating Dockerfile");
    processVarsInFile(`${dir}/Dockerfile`, {
        service_name
    });

    await installOrUpdateCli(cmd);

    await connectToVertesia();

    installDeps(cmd);

}
