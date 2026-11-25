import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { basename, resolve } from 'node:path';
import { NodeStreamSource } from '@vertesia/client/node';
import {
    type CreateDataStorePayload,
    DataStoreDataWriteVersioning,
    type DataStoreItem,
    DataStoreStorageFormat,
    type DataStoreVersioning,
    type ImportDataFormat,
    type ImportDataPayload,
    type ImportTableData,
    type UpdateDataStorePayload,
} from '@vertesia/common';
import type { Command } from 'commander';
import mime from 'mime';
import { findArtifactStorageId } from '../agent-context.js';
import { getClient } from '../client.js';
import { type CliOptions, getStringOption } from '../utils/options.js';

const IMPORT_MODES = new Set(['append', 'replace']);
const IMPORT_FORMATS = new Set<ImportDataFormat>(['csv', 'json', 'parquet']);

export type ImportDataOptions = CliOptions<{
    json?: boolean;
    mode?: string;
    format?: string;
    name?: string;
    prefix?: string;
    mime?: string;
    message?: string;
    keepVersion?: boolean;
    skipVersion?: boolean;
}>;

const STORAGE_FORMATS = new Set<string>(Object.values(DataStoreStorageFormat));
const DATA_WRITE_VERSIONING = new Set<string>(Object.values(DataStoreDataWriteVersioning));

export type CreateDataStoreOptions = CliOptions<{
    description?: string;
    tag?: string[];
    storageFormat?: string;
    dataWrites?: string;
    json?: boolean;
}>;

export type UpdateDataStoreOptions = CliOptions<{
    dataWrites?: string;
    json?: boolean;
}>;

/** The payload of `vertesia data create`: the format and versioning are sent only when the caller names them. */
export function buildCreateDataStorePayload(name: string, options: CreateDataStoreOptions): CreateDataStorePayload {
    const payload: CreateDataStorePayload = { name };
    const description = getStringOption(options.description);
    if (description) payload.description = description;
    const tags = Array.isArray(options.tag) ? options.tag.filter((tag) => typeof tag === 'string' && tag) : [];
    if (tags.length > 0) payload.tags = tags;
    const format = getStringOption(options.storageFormat);
    if (format !== undefined) {
        if (!STORAGE_FORMATS.has(format)) {
            throw new Error(`Invalid --storage-format '${format}': use ${[...STORAGE_FORMATS].join(' or ')}`);
        }
        payload.storage_format = format as CreateDataStorePayload['storage_format'];
    }
    const versioning = buildVersioning(options.dataWrites);
    if (versioning) payload.versioning = versioning;
    return payload;
}

/** The payload of `vertesia data update`: only the settings the caller names. */
export function buildUpdateDataStorePayload(options: UpdateDataStoreOptions): UpdateDataStorePayload {
    const versioning = buildVersioning(options.dataWrites);
    if (!versioning) {
        throw new Error('Nothing to update: pass --data-writes keep|skip');
    }
    return { versioning };
}

function buildVersioning(rawDataWrites: unknown): DataStoreVersioning | undefined {
    const dataWrites = getStringOption(rawDataWrites);
    if (dataWrites === undefined) return undefined;
    if (!DATA_WRITE_VERSIONING.has(dataWrites)) {
        throw new Error(`Invalid --data-writes '${dataWrites}': use ${[...DATA_WRITE_VERSIONING].join(' or ')}`);
    }
    return { data_writes: dataWrites as DataStoreDataWriteVersioning };
}

/**
 * The `version` of an import: `--keep-version` or `--skip-version` override the store's default, and neither leaves
 * the choice to the store, so nothing is sent.
 */
export function importVersionChoice(
    options: Pick<ImportDataOptions, 'keepVersion' | 'skipVersion'>,
): boolean | undefined {
    if (options.keepVersion === true && options.skipVersion === true) {
        throw new Error('Pass --keep-version or --skip-version, not both');
    }
    if (options.keepVersion === true) return true;
    if (options.skipVersion === true) return false;
    return undefined;
}

export async function updateDataStore(program: Command, storeId: string, options: UpdateDataStoreOptions) {
    const payload = buildUpdateDataStorePayload(options);
    const client = await getClient(program);
    const store = await client.data.update(storeId, payload);
    if (options.json) {
        console.log(JSON.stringify(store, null, 2));
        return;
    }
    // A server older than the field keeps every data write.
    console.log(
        `Updated data store ${store.id} (data writes: ${store.versioning?.data_writes ?? DataStoreDataWriteVersioning.KEEP})`,
    );
}

export async function createDataStore(program: Command, name: string, options: CreateDataStoreOptions) {
    const payload = buildCreateDataStorePayload(name, options);
    const client = await getClient(program);
    const store = await client.data.create(payload);
    if (options.json) {
        console.log(JSON.stringify(store, null, 2));
        return;
    }
    // A server older than the field keeps every store in duckdb format.
    console.log(
        `Created data store ${store.id} (${store.name}, ${store.storage_format ?? DataStoreStorageFormat.DUCKDB})`,
    );
}

export async function listStorageFormats(program: Command, options: CliOptions<{ json?: boolean }>) {
    const client = await getClient(program);
    const formats = await client.data.listStorageFormats();
    console.log(options.json ? JSON.stringify(formats) : formats.join('\n'));
}

export async function listDataStores(program: Command, options: CliOptions<{ json?: boolean }>) {
    const client = await getClient(program);
    const stores = await client.data.list();

    if (options.json) {
        console.log(JSON.stringify(stores, null, 2));
        return;
    }

    console.log('id\tname\tstatus\ttables\trows\tbytes\tformat');
    stores.forEach((store: DataStoreItem) => {
        console.log(
            [
                store.id,
                store.name,
                store.status,
                store.table_count,
                store.total_rows,
                store.storage_bytes,
                store.storage_format ?? DataStoreStorageFormat.DUCKDB,
            ].join('\t'),
        );
    });
}

export async function importData(
    program: Command,
    storeId: string,
    tableName: string,
    input: string | undefined,
    options: ImportDataOptions,
) {
    // Checked before anything is uploaded.
    const version = importVersionChoice(options);
    const client = await getClient(program);
    const mode = normalizeMode(options.mode);
    const source = await resolveImportSource(client, storeId, input, options);
    const message = buildImportMessage(tableName, source.label, options.message);
    const payload: ImportDataPayload = {
        mode,
        message,
        tables: {
            [tableName]: source.tableData,
        },
        ...(version !== undefined ? { version } : {}),
    };

    const job = await client.data.import(storeId, payload);

    if (options.json) {
        console.log(JSON.stringify(job, null, 2));
        return;
    }

    console.log(
        `Import status for ${tableName}: ${job.status}. Job: ${job.id}. Rows imported: ${job.rows_imported ?? 0}.`,
    );
    if (source.uploadedUri) {
        console.log(`Source uploaded to: ${source.uploadedUri}`);
    }
}

function normalizeMode(rawMode: unknown): 'append' | 'replace' {
    if (typeof rawMode !== 'string' || rawMode.trim() === '') {
        return 'append';
    }

    const mode = rawMode.trim().toLowerCase();
    if (!IMPORT_MODES.has(mode)) {
        console.error(`Error: Invalid import mode '${rawMode}'. Expected append or replace.`);
        process.exit(1);
    }

    return mode as 'append' | 'replace';
}

function normalizeFormat(rawFormat: unknown, fallbackName?: string): ImportDataFormat {
    if (typeof rawFormat === 'string' && rawFormat.trim() !== '') {
        const format = rawFormat.trim().toLowerCase();
        if (IMPORT_FORMATS.has(format as ImportDataFormat)) {
            return format as ImportDataFormat;
        }
        console.error(`Error: Invalid format '${rawFormat}'. Expected csv, json, or parquet.`);
        process.exit(1);
    }

    const inferred = inferFormatFromName(fallbackName);
    if (inferred) {
        return inferred;
    }

    console.error('Error: Could not infer import format. Pass --format csv|json|parquet.');
    process.exit(1);
}

function inferFormatFromName(name?: string): ImportDataFormat | undefined {
    if (!name) return undefined;
    const lower = name.toLowerCase();
    if (lower.endsWith('.csv')) return 'csv';
    if (lower.endsWith('.json') || lower.endsWith('.jsonl') || lower.endsWith('.ndjson')) return 'json';
    if (lower.endsWith('.parquet')) return 'parquet';
    return undefined;
}

async function resolveImportSource(
    client: Awaited<ReturnType<typeof getClient>>,
    storeId: string,
    input: string | undefined,
    options: ImportDataOptions,
): Promise<{ tableData: ImportTableData; label: string; uploadedUri?: string }> {
    const normalizedInput = typeof input === 'string' && input.trim() !== '' ? input.trim() : '-';

    // Cloud blob URIs (GCS, S3, Azure Blob) are read server-side; `gcs` is the source kind for all of them.
    if (/^(gs|s3|az):\/\//.test(normalizedInput)) {
        return {
            label: normalizedInput,
            tableData: {
                source: 'gcs',
                uri: normalizedInput,
                format: normalizeFormat(options.format, normalizedInput),
            },
        };
    }

    if (normalizedInput.startsWith('http://') || normalizedInput.startsWith('https://')) {
        return {
            label: withoutUrlSecrets(normalizedInput),
            tableData: {
                source: 'url',
                uri: normalizedInput,
                format: normalizeFormat(options.format, normalizedInput),
            },
        };
    }

    const uploadName = resolveUploadName(normalizedInput, options.name);
    const format = normalizeFormat(options.format, uploadName);
    const uploadPath = buildImportUploadPath(uploadName, storeId, options);
    const mimeType = getStringOption(options.mime) || mime.getType(uploadName) || 'application/octet-stream';
    const source =
        normalizedInput === '-'
            ? new NodeStreamSource(process.stdin, uploadName, mimeType, uploadPath)
            : new NodeStreamSource(createReadStream(resolve(normalizedInput)), uploadName, mimeType, uploadPath);
    const uploadedUri = await client.files.uploadFile(source);

    return {
        label: uploadName,
        uploadedUri,
        tableData: {
            source: 'gcs',
            uri: uploadedUri,
            format,
        },
    };
}

function resolveUploadName(input: string, explicitName: unknown): string {
    if (typeof explicitName === 'string' && explicitName.trim() !== '') {
        return basename(explicitName.trim());
    }

    if (input === '-') {
        console.error('Error: --name is required when importing from stdin.');
        process.exit(1);
    }

    return basename(input);
}

/**
 * Where an uploaded local file is staged in project storage. Inside an agent run it goes under the run's artifact
 * storage; from a workstation there is no run, so it goes under the target store.
 */
export function buildImportUploadPath(name: string, storeId: string, options: ImportDataOptions): string {
    const optionPrefix = getStringOption(options.prefix);
    const prefix = optionPrefix
        ? optionPrefix.replace(/^\/+|\/+$/g, '')
        : `imports/${findArtifactStorageId(options) ?? `data-stores/${storeId}`}`;
    return `${prefix}/${Date.now()}-${randomUUID()}-${name}`;
}

/**
 * The version message of an import, unless the caller wrote one. It names the source by a label: everyone who can see
 * the store reads the version history, so a local file appears by its file name rather than its path, which would
 * show the importer's home folder, and a web URL without the parts that can carry a credential.
 */
export function buildImportMessage(tableName: string, sourceLabel: string, explicitMessage: unknown): string {
    if (typeof explicitMessage === 'string' && explicitMessage.trim() !== '') {
        return explicitMessage.trim();
    }
    return `Import ${sourceLabel} into ${tableName} via vertesia CLI`;
}

/** A web URL without its user information, query and fragment: a signed URL carries its token in the query. */
export function withoutUrlSecrets(url: string): string {
    try {
        const parsed = new URL(url);
        parsed.username = '';
        parsed.password = '';
        parsed.search = '';
        parsed.hash = '';
        return parsed.toString();
    } catch {
        // Not a URL the runtime can parse: drop the same parts by hand.
        return url.split(/[?#]/)[0].replace(/^(https?:\/\/)[^/]*@/, '$1');
    }
}
