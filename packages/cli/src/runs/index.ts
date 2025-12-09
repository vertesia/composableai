import { Command } from "commander";
import { getClient } from "../client.js";
import { writeFile } from "../utils/stdio.js";

export async function runHistory(program: Command, interactionId: string | undefined, options: Record<string, any>) {
    const client = await getClient(program);

    const page = options.page ? parseInt(options.page) : 0;
    let limit = options.limit ? parseInt(options.limit) : 100;
    if (limit <= 0) limit === 100;
    const offset = page * limit;

    const response = await client.runs.search({
        limit, offset,
        query: {
            interaction: interactionId || undefined,
            tags: options.tags ? options.tags.split(/\s*,\s*/) : undefined,
            status: options.status || undefined,
            environment: options.env || undefined,
            model: options.model || undefined,
            query: options.query as string || undefined,
            start: options.start as string || undefined,
            end: options.end as string || undefined,
        },

    });

    const runs = response || [];
    let out;
    if (options.format === 'json') {
        out = JSON.stringify(runs, undefined, 4);
    } else if (options.format === 'jsonl') {
        const lines = [];
        for (const run of runs) {
            lines.push(JSON.stringify(run));
        }
        out = lines.join('\n');
    } else if (options.format === 'csv') {
        throw new Error('CSV format is not supported yet');
    } else {
        throw new Error('Unknown format:' + options.format);
    }

    if (typeof options.output === 'string') {
        writeFile(options.output, out);
    } else {
        console.log(out);
    }
}
