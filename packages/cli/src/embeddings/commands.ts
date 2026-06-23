import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import {
    type ExportContentObjectsFilter,
    type ExportContentObjectsPageRequest,
    SupportedEmbeddingTypes,
} from '@vertesia/common';
import {
    type ContentExportProgress,
    createContentExportFilename,
    iterateContentExportRecords,
} from '@vertesia/content-export';
import type { Command } from 'commander';
import { getClient } from '../client.js';
import { config } from '../profiles/index.js';
import { type CliOptions, getBooleanOption, getStringOption } from '../utils/options.js';

type ExportEmbeddingsOptions = CliOptions<{
    output?: string;
    compression?: string;
    embeddingTypes?: string;
    objectType?: string;
    createdFrom?: string;
    createdTo?: string;
    updatedFrom?: string;
    updatedTo?: string;
    allRevisions?: boolean;
    content?: boolean;
    status?: boolean;
    properties?: boolean;
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
    request: ExportContentObjectsPageRequest,
    onProgress: (progress: ContentExportProgress) => void,
): AsyncGenerator<Buffer> {
    for await (const record of iterateContentExportRecords(client, request, { onProgress })) {
        yield Buffer.from(`${JSON.stringify(record)}\n`, 'utf8');
    }
}

function buildExportRequest(options: ExportEmbeddingsOptions): ExportContentObjectsPageRequest {
    return {
        embedding_types: parseEmbeddingTypes(options.embeddingTypes),
        filter: buildFilter(options),
        all_revisions: getBooleanOption(options.allRevisions),
        include: {
            embeddings: true,
            content: options.content !== false,
            status: options.status !== false,
            properties: options.properties !== false,
            metadata: getBooleanOption(options.includeMetadata),
        },
    };
}

function buildFilter(options: ExportEmbeddingsOptions): ExportContentObjectsFilter | undefined {
    const filter: ExportContentObjectsFilter = {};
    const objectType = getStringOption(options.objectType);
    const createdFrom = getStringOption(options.createdFrom);
    const createdTo = getStringOption(options.createdTo);
    const updatedFrom = getStringOption(options.updatedFrom);
    const updatedTo = getStringOption(options.updatedTo);

    if (objectType) {
        filter.type = objectType;
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

function normalizeCompression(rawCompression: unknown): ExportCompression {
    const compression = (getStringOption(rawCompression) ?? 'gzip').toLowerCase();
    if (compression === 'gzip' || compression === 'none') {
        return compression;
    }
    console.error(`Error: Invalid compression '${compression}'. Expected gzip or none.`);
    process.exit(1);
}

function createProgressReporter(options: ExportEmbeddingsOptions): (progress: ContentExportProgress) => void {
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
    return `${createContentExportFilename({ id: projectId, name: project?.name })}.${suffix}`;
}
