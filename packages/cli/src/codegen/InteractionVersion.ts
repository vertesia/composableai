import { InteractionRefWithSchema, InteractionStatus, mergePromptsSchema } from "@vertesia/common";
import { compile as compileSchema } from 'json-schema-to-typescript';
import { join } from 'path';
import { writeFile } from "../utils/stdio.js";
import { processTemplate } from "./template.js";
import { textToPascalCase } from "./utils.js";

export interface InteractionsExportOptions {
    dir: string,
    project: string,
    exportVersion?: string,
}

export interface InteractionTemplateVars extends Record<string, string> {
    id: string;
    doc: string;
    className: string;
    projectId: string; // the project id
    inputType: string;
    outputType: string;
    types: string;
    date: string;
}

export function processInteractionTemplate(vars: InteractionTemplateVars) {
    return processTemplate('interaction', { ...vars, date: new Date().toISOString() });
}

export class InteractionVersion {

    isDraft: boolean;
    className: string;

    constructor(public interaction: InteractionRefWithSchema) {
        this.isDraft = interaction.status === InteractionStatus.draft;
        this.className = textToPascalCase(interaction.name || '__Unknown');
    }

    get isLatest() {
        //TODO we no more support the latest version
        return false;
        //return this.interaction.latest;
    }

    get versionName() {
        return this.isDraft ? 'draft' : `v${this.interaction.version}`;
    }
    get fileName() {
        return `${this.versionName}.ts`;
    }

    async build(dir: string, opts: InteractionsExportOptions) {
        const file = join(dir, this.fileName);
        writeFile(file, await this.genCode(opts));
        return file;
    }

    async genCode(opts: InteractionsExportOptions) {
        const interaction = this.interaction;
        const className = this.className;
        const inputSchema = mergePromptsSchema(interaction);
        const outputSchema = interaction.result_schema;

        const out = [];
        const types = [];
        let inputTypeName = "any";
        let outputTypeName = "any";
        if (inputSchema) {
            inputTypeName = className + 'Props';
            const schemaType = await compileSchema(inputSchema, inputTypeName, {
                bannerComment: '',
                style: {
                    tabWidth: 4,
                },
                additionalProperties: false
            });
            types.push(`/**\n * ${interaction.name} input type\n */`, schemaType);
        }
        if (outputSchema) {
            outputTypeName = className + 'Result';
            const schemaType = await compileSchema(outputSchema, outputTypeName, {
                bannerComment: '',
                style: {
                    tabWidth: 4,
                },
                additionalProperties: false
            });
            types.push(`/**\n * ${interaction.name} result type\n */`, schemaType);
        }
        const vars: InteractionTemplateVars = {
            className: className,
            id: interaction.id,
            projectId: opts.project,
            inputType: inputTypeName,
            outputType: outputTypeName,
            doc: interaction.description ? `${interaction.name}\n${interaction.description}` : interaction.name,
            date: new Date().toISOString(),
            types: types.join('\n')
        };
        out.push(processInteractionTemplate(vars));

        return out.join('\n');
    }
}