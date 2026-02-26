import { readFileSync, rmSync, writeFileSync } from "fs";
import { basename, resolve } from "path";
import * as ts from "typescript";

function compile(fileNames: string[], options: ts.CompilerOptions): { errors: number, emittedFiles: string[] | undefined } {
    const program = ts.createProgram(fileNames, {
        ...options,
        listEmittedFiles: true,
    } satisfies ts.CompilerOptions);
    const emitResult = program.emit();

    const allDiagnostics = ts
        .getPreEmitDiagnostics(program)
        .concat(emitResult.diagnostics);

    let errors = 0;
    allDiagnostics.forEach(diagnostic => {
        let prefix = '';
        const categories = new Set<ts.DiagnosticCategory>();
        if (diagnostic.relatedInformation && diagnostic.relatedInformation.length > 0) {
            for (const ri of diagnostic.relatedInformation) {
                categories.add(ri.category);
            }
            if (categories.has(ts.DiagnosticCategory.Error)) {
                prefix = 'Error: ';
                errors++;
            } else if (categories.has(ts.DiagnosticCategory.Warning)) {
                prefix = 'Warning: ';
            } else if (categories.has(ts.DiagnosticCategory.Suggestion)) {
                prefix = 'Suggestion: ';
            }
        }
        if (diagnostic.file) {
            const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!);
            const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
            console.log(`${prefix}${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
        } else {
            console.log(prefix + ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
        }
    });

    return {
        errors,
        emittedFiles: emitResult.emittedFiles
    }
}

function transpileFile(source: string, target: string, options: ts.CompilerOptions) {
    const input = readFileSync(source, "utf-8");
    // now simply transpile the module to javascript
    const output = ts.transpileModule(input, {
        compilerOptions: options
    });
    writeFileSync(target, output.outputText, "utf-8");
}


function tryDeleteFile(file: string) {
    try {
        rmSync(file)
    } catch (_er: any) {
        // ignore
    }
}

export function importTsFile(file: string, outdir: string = '.'): Promise<any> {
    if (!file.endsWith('.ts')) {
        throw new Error("Not a type script file: " + file);
    }
    file = resolve(file);
    const baseOptions = {
        skipLibCheck: true,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
    } satisfies ts.CompilerOptions;
    // we nly use compile to find errors. To generate the code we use transpileModule
    // since the compile will generate js files for all the dependencies.
    const result = compile([file], {
        ...baseOptions,
        noEmit: true
    });
    if (result.errors > 0) {
        console.log(`Found ${result.errors} in typescript compilation. Aborting.`);
        process.exit(1);
    }
    const fname = basename(file).slice(0, -3);
    const emittedFile = resolve(outdir, `__${Date.now()}-${fname}.mjs`);
    transpileFile(file, emittedFile, baseOptions);

    return import(emittedFile).finally(() => tryDeleteFile(emittedFile));
}
