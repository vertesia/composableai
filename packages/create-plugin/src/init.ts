import enquirer from "enquirer";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { chdir } from "node:process";
import { fileURLToPath } from "node:url";
import { copyTree } from "./copy.js";
import { hasBin } from "./hasBin.js";
import { Package } from "./Package.js";
//import { ToolTemplateInit } from "./ToolTemplateInit.js";
import { WebTemplateInit } from "./WebTemplateInit.js";

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
    {
        name: "isolation",
        type: "select",
        message: "Isolation strategy",
        initial: 0,
        choices: [
            { message: "Shadow DOM", name: "shadow", hint: "Shadow DOM will be used to fully isolate the plugin." },
            { message: "CSS-only isolation", name: "css", hint: "Injects Tailwind utilities into host DOM; not fully isolated. Lighter but may generate conflicts" }
        ]
    }
        // {
        //     name: 'template',
        //     type: 'select',
        //     message: "Template to use",
        //     initial: 0,
        //     choices: [
        //         { message: 'Web plugin', name: 'web' },
        //         { message: 'Agent tool', name: 'tool' },
        //     ]
        // },
    ]);

    //const templateName = answer.template;
    const templateName = "web";

    //const templateInit = templateName === 'web' ? new WebTemplateInit(answer) : new ToolTemplateInit(answer);
    const templateInit = new WebTemplateInit(answer);
    const pluginName = templateInit.pluginName;

    let dir: string;
    if (!dirName) {
        dirName = pluginName.name;
        dir = join(process.cwd(), dirName!);
    } else {
        dir = resolve(dirName);
    }
    mkdirSync(dir, { recursive: true });
    chdir(dir);

    const templateProps = {
        suffix: '.tmpl',
        context: templateInit.getVars()
    }
    // copy template to current directory and process template files
    const templsDir = resolve(fileURLToPath(import.meta.url), '../../templates');
    if (templateName === 'web') {
        await copyTree(join(templsDir, "web"), dir, templateProps);
    } else if (answer.template === 'tool') {
        await copyTree(join(templsDir, "tool"), dir, templateProps);
    } else {
        throw new Error("Invalid template type");
    }

    console.log("Generating package.json");
    const pkg = new Package(templateInit.getPackageJson());

    pkg.saveTo(`${dir}/package.json`);

    templateInit.installDeps();
}
