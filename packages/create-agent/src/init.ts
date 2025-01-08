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
        console.error("Docker is not installed. Please install Docker first.");
        process.exit(1);
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
        name: 'agent_org',
        type: 'input',
        message: "Organization name (e.g. mycompany)",
        validate: (input: string) => /[a-zA-Z_][a-zA-Z_0-9-]/g.test(input),
    }, {
        name: 'agent_name',
        type: 'input',
        message: "Agent name (e.g. myagent)",
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
    const templDir = resolve(fileURLToPath(import.meta.url), '../../template');
    await copyTree(templDir, dir);

    console.log("Generating package.json");
    const pkg = new Package({
        name: '@' + answer.agent_org + '/' + answer.agent_name,
        version: answer.version || '1.0.0',
        description: answer.description || '',
        type: 'module',
        main: 'lib/index.js',
        types: 'lib/index.d.ts',
        scripts: {
            "clean": "rimraf ./lib tsconfig.tsbuildinfo",
            "build": "${npm_package_vertesia_pm} run clean && tsc --build && node ./bin/bundle-workflows.mjs lib/workflows.js lib/workflows-bundle.js",
            "start": "node lib/main.js",
            "connect": `${VERTESIA_CLI} agent connect`,
        },
        vertesia: {
            pm: cmd,
            image: {
                repository: "us-docker.pkg.dev/dengenlabs/us.gcr.io",
                organization: answer.agent_org,
                name: answer.agent_name,
            }
        }
    });

    pkg.saveTo(`${dir}/package.json`);

    const service_name = answer.agent_org + '_' + answer.agent_name;
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
