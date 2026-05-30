import type { Command } from 'commander';
import type { ExecutionRunStatus } from '@vertesia/common';
import { getClient } from '../client.js';
import { writeFile } from '../utils/stdio.js';
import { getStringOption, type CliOptions } from '../utils/options.js';

type RunHistoryOptions = CliOptions<{
    page?: string;
    limit?: string;
    tags?: string;
    status?: ExecutionRunStatus;
    env?: string;
    model?: string;
    query?: string;
    start?: string;
    end?: string;
    format?: 'json' | 'jsonl' | 'csv';
    output?: string;
}>;

export async function runHistory(program: Command, interactionId: string | undefined, options: RunHistoryOptions) {
    const client = await getClient(program);

    const page = options.page ? parseInt(options.page, 10) : 0;
    let limit = options.limit ? parseInt(options.limit, 10) : 100;
    if (limit <= 0) {
        limit = 100;
    }
    const offset = page * limit;

    const response = await client.runs.search({
        limit,
        offset,
        query: {
            interaction: interactionId || undefined,
            tags: getStringOption(options.tags)?.split(/\s*,\s*/),
            status: options.status || undefined,
            environment: options.env || undefined,
            model: options.model || undefined,
            query: options.query || undefined,
            start: options.start || undefined,
            end: options.end || undefined,
        },
    });

    const runs = response || [];
    let out: string;
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
        throw new Error(`Unknown format:${options.format}`);
    }

    if (typeof options.output === 'string') {
        writeFile(options.output, out);
    } else {
        console.log(out);
    }
}
