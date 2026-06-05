import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { type ComplexSearchQuery, type ExportEmbeddingsPageRequest, SupportedEmbeddingTypes } from '@vertesia/common';
import {
    createEmbeddingsExportFilename,
    type EmbeddingsExportProgress,
    iterateEmbeddingExportRecords,
} from '@vertesia/embeddings-export';
import type { Command } from 'commander';
import { getClient } from '../client.js';
import { config } from '../profiles/index.js';
import { type CliOptions, getBooleanOption, getStringOption } from '../utils/options.js';

type ExportEmbeddingsOptions = CliOptions<{
    output?: string;
    compression?: string;
    embeddingTypes?: string;
    limit?: string;
    query?: string;
    objectType?: string;
    status?: string;
    path?: string;
    name?: string;
    allRevisions?: boolean;
    includeProperties?: boolean;
    includeMetadata?: boolean;
    quiet?: boolean;
}>;

type ExportCompression = 'gzip' | 'none';

export async function exportEmbeddings(program: Command, options: ExportEmbeddingsOptions) {
    const client = await getClient(program);
    const compression = normalizeCompression(options.compression);
    const outputPath = getStringOption(options.output) ?? (await defaultOutputPath(client, compression));
    const request = buildExportRequest(options);
    const progress = createProgressReporter(options);
    const source = Readable.from(createJsonlBuffers(client.store, request, progress));
    const destination = createWriteStream(outputPath);

    if (compression === 'gzip') {
        await pipeline(source, createGzip(), destination);
    } else {
        await pipeline(source, destination);
    }

    if (!getBooleanOption(options.quiet)) {
        process.stderr.write(`\nExport written to ${outputPath}\n`);
    }
}

async function* createJsonlBuffers(
    client: Awaited<ReturnType<typeof getClient>>['store'],
    request: ExportEmbeddingsPageRequest,
    onProgress: (progress: EmbeddingsExportProgress) => void,
): AsyncGenerator<Buffer> {
    for await (const record of iterateEmbeddingExportRecords(client, request, { onProgress })) {
        yield Buffer.from(`${JSON.stringify(record)}\n`, 'utf8');
    }
}

function buildExportRequest(options: ExportEmbeddingsOptions): ExportEmbeddingsPageRequest {
    return {
        embedding_types: parseEmbeddingTypes(options.embeddingTypes),
        limit: parseLimit(options.limit),
        query: buildQuery(options),
        all_revisions: getBooleanOption(options.allRevisions),
        include: {
            properties: getBooleanOption(options.includeProperties),
            metadata: getBooleanOption(options.includeMetadata),
        },
    };
}

function buildQuery(options: ExportEmbeddingsOptions): ComplexSearchQuery | undefined {
    const query = parseQuery(options.query);
    const objectType = getStringOption(options.objectType);
    const status = getStringOption(options.status);
    const path = getStringOption(options.path);
    const name = getStringOption(options.name);

    if (objectType) {
        query.type = objectType;
    }
    if (status) {
        query.status = status;
    }
    if (path) {
        query.location = path;
    }
    if (name) {
        query.name = name;
    }

    return Object.keys(query).length > 0 ? query : undefined;
}

function parseQuery(rawQuery: unknown): ComplexSearchQuery {
    const queryText = getStringOption(rawQuery);
    if (!queryText) {
        return {};
    }
    try {
        const parsed = JSON.parse(queryText) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('query must be a JSON object');
        }
        return parsed as ComplexSearchQuery;
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: Invalid --query JSON: ${message}`);
        process.exit(1);
    }
}

function parseEmbeddingTypes(rawTypes: unknown): SupportedEmbeddingTypes[] | undefined {
    const typesText = getStringOption(rawTypes);
    if (!typesText) {
        return undefined;
    }
    const types = typesText
        .split(',')
        .map((type) => type.trim())
        .filter(Boolean);
    for (const type of types) {
        if (!Object.values(SupportedEmbeddingTypes).includes(type as SupportedEmbeddingTypes)) {
            console.error(`Error: Invalid embedding type '${type}'. Expected text, image, or properties.`);
            process.exit(1);
        }
    }
    return types as SupportedEmbeddingTypes[];
}

function parseLimit(rawLimit: unknown): number | undefined {
    const limitText = getStringOption(rawLimit);
    if (!limitText) {
        return undefined;
    }
    const limit = Number.parseInt(limitText, 10);
    if (!Number.isInteger(limit) || limit < 1) {
        console.error(`Error: Invalid --limit '${limitText}'. Expected a positive integer.`);
        process.exit(1);
    }
    return limit;
}

function normalizeCompression(rawCompression: unknown): ExportCompression {
    const compression = (getStringOption(rawCompression) ?? 'gzip').toLowerCase();
    if (compression === 'gzip' || compression === 'none') {
        return compression;
    }
    console.error(`Error: Invalid compression '${compression}'. Expected gzip or none.`);
    process.exit(1);
}

function createProgressReporter(options: ExportEmbeddingsOptions): (progress: EmbeddingsExportProgress) => void {
    if (getBooleanOption(options.quiet)) {
        return () => {};
    }
    return (progress) => {
        process.stderr.write(`\rExported ${progress.records} embedding records across ${progress.pages} page(s)...`);
    };
}

async function defaultOutputPath(
    client: Awaited<ReturnType<typeof getClient>>,
    compression: ExportCompression,
): Promise<string> {
    const suffix = compression === 'gzip' ? 'jsonl.gz' : 'jsonl';
    const projectId =
        process.env.VERTESIA_PROJECT_ID || process.env.COMPOSABLE_PROMPTS_PROJECT_ID || config.current?.project;
    const project = projectId ? await client.projects.retrieve(projectId) : undefined;
    return `${createEmbeddingsExportFilename({ id: projectId, name: project?.name })}.${suffix}`;
}
