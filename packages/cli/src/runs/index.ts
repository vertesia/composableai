import type { ExecutionRunStatus } from '@vertesia/common';
import type { Command } from 'commander';
import { getClient } from '../client.js';
import { type CliOptions, getStringOption } from '../utils/options.js';
import { writeFile } from '../utils/stdio.js';

type RunHistoryOptions = CliOptions<{
    page?: string;
    limit?: string;
    tags?: string;
    status?: ExecutionRunStatus;
    env?: string;
    model?: string;
    app?: string;
    query?: string;
    start?: string;
    end?: string;
    format?: 'json' | 'jsonl';
    output?: string;
}>;

/**
 * The tags a run search must carry. `--app` selects the runs of one App Builder app: the server tags every
 * development-task run with `app:<app name>`. The server does not evaluate a free-text query on `/runs/search`,
 * so an app filter has to go through tags.
 */
export function runSearchTags(tags: unknown, app: unknown): string[] | undefined {
    const appName = getStringOption(app);
    const all = [...(getStringOption(tags)?.split(/\s*,\s*/) ?? []), ...(appName ? [`app:${appName}`] : [])];
    return all.length > 0 ? all : undefined;
}

export async function runHistory(program: Command, interactionId: string | undefined, options: RunHistoryOptions) {
    if (options.query !== undefined) {
        // Accepted only to answer it: the server never filtered by text, so old scripts got unrelated runs.
        throw new Error(
            '--query is not supported: the server does not filter runs by text. Use --app <name> or --tags.',
        );
    }
    if (options.format !== 'json' && options.format !== 'jsonl') {
        throw new Error(`Unknown format:${options.format}. Supported formats: json, jsonl`);
    }
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
            tags: runSearchTags(options.tags, options.app),
            status: options.status || undefined,
            environment: options.env || undefined,
            model: options.model || undefined,
            start: options.start || undefined,
            end: options.end || undefined,
        },
    });

    const runs = response || [];
    const out =
        options.format === 'jsonl'
            ? runs.map((run) => JSON.stringify(run)).join('\n')
            : JSON.stringify(runs, undefined, 4);

    if (typeof options.output === 'string') {
        writeFile(options.output, out);
    } else {
        console.log(out);
    }
}

export function registerRunsCommand(program: Command) {
    program
        .command('runs [interactionId]')
        .description('Search the run history for specific execution runs')
        .option('-t, --tags [tags]', 'A comma separated list of tags to filter the run history')
        .option('--status [status]', 'A status to filter on')
        .option('-e, --env [environmentId]', 'Filter by environment')
        .option('--inference-profile <id>', 'Use this inference profile for this run only')
        .option('-m, --model [model]', 'Filter by model')
        .option('-a, --app <name>', 'Only the runs of this App Builder app (its name, as in "apps list")')
        .option('-q, --query [query]', 'Not supported: the server does not filter runs by text; use --app or --tags')
        .option('-l, --limit [limit]', 'The maximum number of runs to return in a page', '100')
        .option('-P, --page [page]', 'The page number to return (starting from 0)', '0')
        .option('-f, --format [format]', 'The output format: json or jsonl.', 'json')
        .option('-o, --output [file]', 'The output file if any. If not specified it will print to stdout')
        .option('--before [date]', 'Filter runs before the given date. The date must be in ISO format')
        .option('--after [date]', 'Filter runs after the given date. The date must be in ISO format')
        .action((interactionId: string | undefined, options: Record<string, unknown>) =>
            runHistory(program, interactionId, options),
        );
}
