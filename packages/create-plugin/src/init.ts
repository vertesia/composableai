import enquirer from "enquirer";
import { mkdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { chdir } from "node:process";
import { fileURLToPath } from "node:url";
import { copyTree } from "./copy.js";
import { installDeps } from "./deps.js";
import { hasBin } from "./hasBin.js";
import { Package } from "./Package.js";
import { processAndRenameTemplateFile, processVarsInFile } from "./template.js";

const { prompt } = enquirer;

export async function init(dirName?: string | undefined) {

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

    const pms = ["npm", "pnpm"];
    const answer: any = await prompt([{
        name: 'pm',
        type: 'select',
        message: "Which package manager to use?",
        initial: pms.indexOf(initialPm),
        choices: pms,
    }, {
        name: 'plugin_name',
        type: 'input',
        message: "Plugin name (use kebab case, e.g. my-plugin)",
        required: true,
        validate: (input: string) => /[a-zA-Z_](-[a-zA-Z_0-9]+)*/g.test(input),
    }, {
        name: 'plugin_version',
        type: 'input',
        message: "PLugin version",
        initial: '1.0.0',
        required: true,
        validate: (input: string) => /[\d]\.[\d].[\d](-[a-zA-Z0-9_]+)?/g.test(input),
    }, {
        name: 'plugin_description',
        type: 'input',
        required: false,
        message: "Package description",
        initial: '',
    }]);

    const cmd = answer.pm;

    // copy template to current directory
    const templDir = resolve(fileURLToPath(import.meta.url), '../../template');
    await copyTree(templDir, dir);

    console.log("Generating package.json");
    const pkg = new Package({
        name: answer.plugin_name,
        version: answer.plugion_version || '1.0.0',
        description: answer.description || '',
        type: 'module',
        main: `dist/${answer.plugin_name}.js`,
        module: `dist/${answer.plugin_name}.js`,
        types: "dist/index.d.ts",
        files: [
            "dist"
        ],
        scripts: {
            "dev": "vite",
            "build": "tsc -b && vite build",
            "lint": "eslint .",
            "preview": "vite preview"
        },
        peerDependencies: {
            "react": "^19.0.0",
            "react-dom": "^19.0.0"
        },
    });

    pkg.saveTo(`${dir}/package.json`);

    const plugin_title = generatePluginTitle(answer.plugin_name);
    const plugin_var_name = generatePluginVarName(answer.plugin_name);
    console.log("Processing source files");
    processVarsInFile(`${dir}/vite.config.js`, {
        plugin_name: answer.plugin_name,
        plugin_var_name
    });
    processVarsInFile(`${dir}/src/index.tsx`, {
        plugin_title
    });
    processVarsInFile(`${dir}/index.html`, {
        plugin_title
    });

    installDeps(cmd);

}


function generatePluginTitle(name: string) {
    const words = name.split('-');
    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function generatePluginVarName(name: string) {
    const words = name.split('-');
    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}