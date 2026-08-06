import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import type { TemplateConfig } from './template-config.js';

const CONTEXT_FILE = '.create-plugin-context.json';

export interface ScaffoldContext {
    projectName: string;
    projectPath: string;
    modules: string[];
    answers: Record<string, unknown>;
    packageManager: string;
    template: {
        name: string;
        repository: string;
    };
}

export function parseModuleOption(values: string[] | undefined): string[] {
    if (!values) return [];

    const modules = values
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter(Boolean);

    return [...new Set(modules)];
}

export function appendModuleOption(value: string, previous: string[]): string[] {
    return [...previous, value];
}

export function runTemplateCodegen(
    projectName: string,
    templateConfig: TemplateConfig,
    context: ScaffoldContext,
): void {
    const codegen = templateConfig.lifecycle?.codegen;
    if (!codegen) return;

    const projectPath = path.resolve(projectName);
    const codegenPath = path.join(projectPath, codegen);
    if (!fs.existsSync(codegenPath)) {
        throw new Error(`Template codegen script not found: ${codegen}`);
    }

    const contextPath = path.join(projectPath, CONTEXT_FILE);
    fs.writeFileSync(contextPath, `${JSON.stringify(context, null, 2)}\n`);

    console.log(chalk.blue('Running template code generation...\n'));
    try {
        execFileSync(process.execPath, [codegen, '--context', CONTEXT_FILE], {
            cwd: projectPath,
            stdio: 'inherit',
        });
    } finally {
        if (fs.existsSync(contextPath)) {
            fs.rmSync(contextPath, { force: true });
        }
    }
    console.log();
}
