import { createWriteStream } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { type ExportContentObjectsFilter, SupportedEmbeddingTypes } from '@vertesia/common';
import type { Command } from 'commander';
import { getClient } from '../client.js';
import { type CliOptions, errorMessage, getBooleanOption, getStringOption, hasStatus } from '../utils/options.js';

type ExportContentOptions = CliOptions<{
    output?: string;
    compress?: boolean;
    embeddingTypes?: string;
    types?: string;
    createdFrom?: string;
    createdTo?: string;
    updatedFrom?: string;
    updatedTo?: string;
    allRevisions?: boolean;
    includeEmbeddings?: boolean;
    content?: boolean;
    status?: boolean;
    properties?: boolean;
    metadata?: boolean;
    revision?: boolean;
    quiet?: boolean;
    json?: boolean;
}>;

const DEFAULT_POLL_INTERVAL_MS = 2000;

export async function exportContentObjects(program: Command, options: ExportContentOptions) {
    const client = await getClient(program);
    const quiet = getBooleanOption(options.quiet);
    const jsonOutput = getBooleanOption(options.json);
    const explicitOutputPath = getStringOption(options.output);
    if (jsonOutput && explicitOutputPath === '-') {
        throw new Error('--json cannot be used with --output - because stdout is reserved for export data.');
    }

    const job = await client.objects
        .startExport({
            ...(options.compress === false ? { compression: false } : {}),
            embedding_types: parseEmbeddingTypes(options.embeddingTypes),
            filter: buildFilter(options),
            all_revisions: getBooleanOption(options.allRevisions),
            include: {
                embeddings: getBooleanOption(options.includeEmbeddings),
                content: options.content !== false,
                status: options.status !== false,
                properties: options.properties !== false,
                metadata: getBooleanOption(options.metadata),
                revision: options.revision !== false,
            },
        })
        .catch((error: unknown) => {
            if (hasStatus(error, 429)) {
                process.stderr.write(`Cannot start content object export: ${errorMessage(error)}\n`);
                process.exitCode = 1;
                return undefined;
            }
            throw error;
        });
    if (!job) {
        return;
    }

    if (!quiet && !jsonOutput) {
        process.stderr.write(`Started export workflow ${job.workflow_id} (${job.run_id})\n`);
    }

    const status = await waitForExport(client, job.workflow_id, job.run_id, quiet || jsonOutput);
    if (!status.result) {
        const message = status.error || `Export workflow finished with status ${status.status}`;
        throw new Error(message);
    }

    const outputPath = explicitOutputPath ?? status.result.filename;
    const stream = await client.objects.downloadExportFile(job.export_id, 'data');
    await pipeline(
        Readable.fromWeb(stream as NodeReadableStream<Uint8Array>),
        outputPath === '-' ? process.stdout : createWriteStream(outputPath),
    );
    const manifestOutputPath =
        outputPath === '-' || !status.result.manifest_path
            ? undefined
            : explicitOutputPath
              ? manifestPathForOutput(outputPath)
              : status.result.manifest_filename;
    if (manifestOutputPath && status.result.manifest_path) {
        const manifestStream = await client.objects.downloadExportFile(job.export_id, 'manifest');
        await pipeline(
            Readable.fromWeb(manifestStream as NodeReadableStream<Uint8Array>),
            createWriteStream(manifestOutputPath),
        );
    }

    if (jsonOutput) {
        console.log(
            JSON.stringify({
                ...status,
                output: outputPath,
                manifest_output: manifestOutputPath,
            }),
        );
    } else if (!quiet) {
        process.stderr.write(
            `Exported ${status.result.records.toLocaleString()} content objects to ${outputPath} (${formatBytes(status.result.bytes)})\n`,
        );
        if (manifestOutputPath) {
            process.stderr.write(`Export manifest written to ${manifestOutputPath}\n`);
        }
    }
}

async function waitForExport(
    client: Awaited<ReturnType<typeof getClient>>,
    workflowId: string,
    runId: string,
    quiet: boolean,
) {
    let lastMessage = '';
    for (;;) {
        const status = await client.objects.getExportStatus(workflowId, runId);
        if (!quiet) {
            const progress = status.progress;
            const message = progress
                ? `\rExport ${progress.status}: ${progress.records.toLocaleString()} records, ${formatBytes(progress.bytes)}`
                : `\rExport ${status.status}`;
            if (message !== lastMessage) {
                process.stderr.write(message);
                lastMessage = message;
            }
        }
        if (status.result || status.done) {
            if (!quiet && lastMessage) {
                process.stderr.write('\n');
            }
            return status;
        }
        await new Promise((resolve) => setTimeout(resolve, DEFAULT_POLL_INTERVAL_MS));
    }
}

function buildFilter(options: ExportContentOptions): ExportContentObjectsFilter | undefined {
    const filter: ExportContentObjectsFilter = {};
    const types = parseCommaSeparatedOption(options.types);
    const createdFrom = getStringOption(options.createdFrom);
    const createdTo = getStringOption(options.createdTo);
    const updatedFrom = getStringOption(options.updatedFrom);
    const updatedTo = getStringOption(options.updatedTo);

    if (types) {
        filter.types = types;
    }
    if (createdFrom) {
        filter.created_from = createdFrom;
    }
    if (createdTo) {
        filter.created_to = createdTo;
    }
    if (updatedFrom) {
        filter.updated_from = updatedFrom;
    }
    if (updatedTo) {
        filter.updated_to = updatedTo;
    }

    return Object.keys(filter).length > 0 ? filter : undefined;
}

function parseEmbeddingTypes(rawTypes: unknown): SupportedEmbeddingTypes[] | undefined {
    const types = parseCommaSeparatedOption(rawTypes);
    if (!types) {
        return undefined;
    }
    for (const type of types) {
        if (!Object.values(SupportedEmbeddingTypes).includes(type as SupportedEmbeddingTypes)) {
            throw new Error(`Invalid embedding type '${type}'. Expected text, image, or properties.`);
        }
    }
    return types as SupportedEmbeddingTypes[];
}

function parseCommaSeparatedOption(value: unknown): string[] | undefined {
    const text = getStringOption(value);
    if (!text) {
        return undefined;
    }
    const values = text
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    return values.length ? values : undefined;
}

function manifestPathForOutput(outputPath: string) {
    const directory = dirname(outputPath);
    const filename = basename(outputPath).replace(/\.jsonl(?:\.gz)?$/, '');
    return join(directory, `${filename}.manifest.json`);
}

function formatBytes(bytes: number) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}
