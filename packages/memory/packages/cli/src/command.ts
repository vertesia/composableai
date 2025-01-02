import { BuildOptions, loadMemoryPack } from '@vertesia/memory';
import { build } from '@vertesia/memory-commands';
import { Command } from 'commander';
import { readFile } from 'fs/promises';
import { dirname } from 'path';
import url from 'url';

export function setupMemoCommand(command: Command, publish?: (file: string, name: string) => Promise<string>) {
    const buildCmd = new Command("build").description("Build a memory pack from a recipe script.");
    buildCmd.allowUnknownOption()
        .option('-i, --indent <spaces>', 'The number of spaces to indent the JSON result. A identation of 2 is used by default.')
        .option('-q, --quiet', 'Do not log anything to the console.')
        .option('-z, --gzip', 'Compress the output file using gzip.')
        .option('-o, --out <file>', 'The output file. Defaults to "memory.tar".')
        .option('-t, --test', 'Test the memory script without building it.')
        .argument('<recipe>', 'The recipe script to build the memory from.')
        .action((_arg: string, options: Record<string, any>, command: Command) => {
            memoAction(command, { ...options, publish }).catch((err: Error) => {
                console.error("Failed to run command: ", err);
                process.exit(1);
            })
        })

    const exportCmd = new Command("export").description("Export a JSON object from the memory pack given a mapping.");
    exportCmd.option('--map <mapping>', 'The mapping to use. An inline JSON object or a path to a JSOn file prefixed with @')
        .option('-i, --indent <spaces>', 'The number of spaces to indent the JSON result. No identation is done by default.')
        .argument('<pack>', 'The uncompressed memory pack to use (i.e. a .tar file).')
        .action((arg: string, options: Record<string, any>, command: Command) => {
            exportAction(command, arg, options).catch((err: Error) => {
                console.error("Failed to run command: ", err);
                process.exit(1);
            })
        });

    command.addCommand(buildCmd);
    command.addCommand(exportCmd);
    return command;
}

function memoAction(command: Command, options: Record<string, any>) {
    const { script, vars } = parseArgs(command.args);
    if (options.indent) {
        options.indent = parseInt(options.indent);
    }
    if (!options.transpileDir) {
        options.transpileDir = dirname(url.fileURLToPath(import.meta.url));
    }
    return build(script!, { ...options, vars } as BuildOptions)
}

/**
 * We take all --var-xxx options and return them as an object to be passed as the `vars` variable to the script
 * @param args
 */
function parseArgs(args: string[]) {
    if (!args.length) {
        console.error("No recipe script was provided.");
        process.exit(1);
    }
    let script: string | undefined;
    const vars: Record<string, any> = {};
    let lastKey: string | undefined;
    let lastCommitedOption: string | undefined;
    for (const arg of args) {
        if (arg.startsWith('--var-')) {
            if (lastKey) {
                vars[lastKey] = true;
            }
            lastKey = arg.substring(6);
        } else if (lastKey) {
            vars[lastKey] = arg;
            lastCommitedOption = lastKey;
            lastKey = undefined;
        } else if (script) {
            console.error(`Ambigous command line arguments. Multiple recipe scripts found: ${script}, ${arg}`);
            process.exit(1);
        } else {
            script = arg;
        }
    }
    if (!script) {
        if (!lastCommitedOption) {
            console.error("Ambigous command line arguments. No recipe script was found.");
            process.exit(1);
        } else {
            script = vars[lastCommitedOption];
            vars[lastCommitedOption] = true;
        }
    }
    return { script, vars };
}

async function exportAction(_command: Command, packFile: string, options: Record<string, any>) {
    let mapParam = options.map;
    if (mapParam.startsWith('@')) {
        mapParam = await readFile(mapParam.substring(1), "utf-8");
    }
    const mapping: Record<string, any> = JSON.parse(mapParam);
    const pack = await loadMemoryPack(packFile);
    const obj = await pack.exportObject(mapping);
    console.log(JSON.stringify(obj, null, options.indent || 2));
}
