import { Builder, BuildOptions } from "@vertesia/memory";
import { AsyncLocalStorage } from "node:async_hooks";
import { resolve } from "path";
import { importTsFile } from "./ts-loader.js";

const als = new AsyncLocalStorage<Builder>();

export function getBuilder() {
    const builder = als.getStore();
    if (!builder) {
        throw new Error("No builder found in the current context.");
    }
    return builder;
}

export function build(script: string, options: BuildOptions = {}): Promise<void> {
    const builder = new Builder(options);
    return als.run(builder, () => {
        return _build(builder, script, options.transpileDir);
    });
}

async function _build(builder: Builder, script: string, transpileDir?: string): Promise<void> {
    const resolvedScript = resolve(script);
    let module: any;
    if (resolvedScript.endsWith('.ts')) {
        try {
            module = await importTsFile(resolvedScript, transpileDir);
        } catch (er: any) {
            console.error(er);
            process.exit(1);
        }
    } else {
        module = await import(resolvedScript);
    }
    const output = module?.default;
    if (!output) {
        throw new Error("No default export found in the script.");
    }
    await builder.build(output);
}
