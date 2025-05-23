import enquirer from "enquirer";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { chdir } from "node:process";
import { fileURLToPath } from "node:url";
import { copyTree } from "./copy.js";
import { installDeps } from "./deps.js";
import { hasBin } from "./hasBin.js";
import { Package } from "./Package.js";

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
    },
        //TODO
        // {
        //     name: 'template',
        //     type: 'select',
        //     message: "Template to use",
        //     initial: 0,
        //     choices: [
        //         { message: 'Web plugin', name: 'web' },
        //         { message: 'Agent tool', name: 'tool' },
        //         { message: 'Workflow Acitity', name: 'activity' },
        //     ]
        // },
    ]);

    //TODO remove this
    (answer as any).template = 'web';

    const cmd = answer.pm;

    const pluginName = new PluginName(answer.plugin_name);

    let dir: string;
    if (!dirName) {
        dirName = answer.plugin_name;
        dir = join(process.cwd(), dirName!);
    } else {
        dir = resolve(dirName);
    }
    mkdirSync(dir, { recursive: true });
    chdir(dir);

    const PluginComponent = pluginName.pascalCase + "Plugin";
    const templateProps = {
        suffix: '.tmpl',
        context: {
            plugin_title: pluginName.title,
            PluginComponent,
        }
    }
    // copy template to current directory and process template files
    const templsDir = resolve(fileURLToPath(import.meta.url), '../../templates');
    if (answer.template === 'web') {
        await copyTree(join(templsDir, "web"), dir, templateProps);
    } else if (answer.template === 'tool') {

    } else if (answer.template === 'activity') {

    } else {
        throw new Error("Invalid template type");
    }

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
        plugin: {
            title: pluginName.title,
            publisher: pluginName.scope || "vertesia",
            external: false,
            status: "beta",
        }
    });

    pkg.saveTo(`${dir}/package.json`);

    installDeps(cmd);
}


class PluginName {
    scope?: string;
    name: string;
    _title?: string;
    constructor(public value: string) {
        if (value.startsWith('@')) {
            const index = value.indexOf('/');
            if (index > -1) {
                this.name = value.substring(index + 1);
                this.scope = value.substring(1, index);
            } else {
                throw new Error("Invalid plugin name");
            }
        } else {
            this.name = value;
            this.scope = undefined
        }
    }
    get title() {
        if (!this._title) {
            this._title = this.name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        }
        return this._title;
    }
    get pascalCase() {
        return this.name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
    }
}