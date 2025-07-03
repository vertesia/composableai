import { readFileSync, renameSync, writeFileSync } from "fs";

const VAR_RX = /\$\{\s*([a-zA-Z_$][a-zA-Z_$0-9]*)\s*\}/g;


export function expandVars(content: string, vars: Record<string, string>) {
    return content.replaceAll(VAR_RX, (m: string, p: string) => p in vars ? vars[p] : m);
}

export function processVarsInFile(file: string, vars: Record<string, string>) {
    const content = readFileSync(file, "utf8");
    writeFileSync(file, expandVars(content, vars), "utf8");
}

export function processAndRenameTemplateFile(file: string, vars: Record<string, string>) {
    processVarsInFile(file, vars);
    if (file.endsWith(".template")) {
        renameSync(file, file.slice(0, -".template".length))
    }
}