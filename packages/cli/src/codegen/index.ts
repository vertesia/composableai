import { Command } from "commander";
import { getClient } from "../client.js";
import { CodeBuilder } from "./CodeBuilder.js";

export default function runExport(program: Command, interactionName: string | undefined, options: Record<string, any>) {
    const client = getClient(program);

    if (!client.project) {
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
    client.interactions.export(payload).then((interactions) => {
        new CodeBuilder().build(interactions, {
            dir: options.dir,
            project: client.project!,
            exportVersion: options.export || undefined,
        });
    }).catch((error) => {
        console.error('Failed to export interactions:', error.message || error);
        process.exit(1);
    })
}
