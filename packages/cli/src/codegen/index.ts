import { Command } from "commander";
import { getClient } from "../client.js";
import { CodeBuilder } from "./CodeBuilder.js";

export default async function runExport(program: Command, interactionName: string | undefined, options: Record<string, any>) {
    const client = getClient(program);
    const project = await client.getProject();
    if (!project) {
        console.error('No project id specified');
        process.exit(1);
    }

    const tags = options.tags ? options.tags.split(/\s*,\s*/) : undefined;
    const versions = options.versions ? options.versions.split(/\s*,\s*/) : ["draft"];

    const payload = {
        name: interactionName,
        tags: tags,
        versions: options.all ? [] : versions,
    }
    try {
        const interactions = await client.interactions.export(payload);
        new CodeBuilder().build(interactions, {
            dir: options.dir,
            project: project.id,
            exportVersion: options.export || undefined,
        });
    } catch (error: any) {
        console.error('Failed to export interactions:', error.message || error);
        process.exit(1);
    }
}
