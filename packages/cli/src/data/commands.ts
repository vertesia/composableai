import { NodeStreamSource } from "@vertesia/client/node";
import { DataStoreItem, ImportDataFormat, ImportDataPayload, ImportTableData } from "@vertesia/common";
import { Command } from "commander";
import mime from "mime";
import { randomUUID } from "node:crypto";
import { basename, resolve } from "node:path";
import { createReadStream } from "node:fs";
import { getArtifactStorageId } from "../agent-context.js";
import { getClient } from "../client.js";

const IMPORT_MODES = new Set(["append", "replace"]);
const IMPORT_FORMATS = new Set<ImportDataFormat>(["csv", "json", "parquet"]);

export async function listDataStores(program: Command, options: Record<string, any>) {
    const client = await getClient(program);
    const stores = await client.data.list();

    if (options.json) {
        console.log(JSON.stringify(stores, null, 2));
        return;
    }

    console.log("id\tname\tstatus\ttables\trows\tbytes");
    stores.forEach((store: DataStoreItem) => {
        console.log(
            [
                store.id,
                store.name,
                store.status,
                store.table_count,
                store.total_rows,
                store.storage_bytes,
            ].join("\t"),
        );
    });
}

export async function importData(program: Command, storeId: string, tableName: string, input: string | undefined, options: Record<string, any>) {
    const client = await getClient(program);
    const mode = normalizeMode(options.mode);
    const source = await resolveImportSource(client, input, options);
    const message = buildImportMessage(tableName, source.original, options.message);
    const payload: ImportDataPayload = {
        mode,
        message,
        tables: {
            [tableName]: source.tableData,
        },
    };

    const job = await client.data.import(storeId, payload);

    if (options.json) {
        console.log(JSON.stringify(job, null, 2));
        return;
    }

    console.log(
        `Import completed for ${tableName}. Job: ${job.id}. Status: ${job.status}. Rows imported: ${job.rows_imported ?? 0}.`,
    );
    if (source.uploadedUri) {
        console.log(`Source uploaded to: ${source.uploadedUri}`);
    }
}

function normalizeMode(rawMode: unknown): "append" | "replace" {
    if (typeof rawMode !== "string" || rawMode.trim() === "") {
        return "append";
    }

    const mode = rawMode.trim().toLowerCase();
    if (!IMPORT_MODES.has(mode)) {
        console.error(`Error: Invalid import mode '${rawMode}'. Expected append or replace.`);
        process.exit(1);
    }

    return mode as "append" | "replace";
}

function normalizeFormat(rawFormat: unknown, fallbackName?: string): ImportDataFormat {
    if (typeof rawFormat === "string" && rawFormat.trim() !== "") {
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

    console.error("Error: Could not infer import format. Pass --format csv|json|parquet.");
    process.exit(1);
}

function inferFormatFromName(name?: string): ImportDataFormat | undefined {
    if (!name) return undefined;
    const lower = name.toLowerCase();
    if (lower.endsWith(".csv")) return "csv";
    if (lower.endsWith(".json") || lower.endsWith(".jsonl") || lower.endsWith(".ndjson")) return "json";
    if (lower.endsWith(".parquet")) return "parquet";
    return undefined;
}

async function resolveImportSource(
    client: Awaited<ReturnType<typeof getClient>>,
    input: string | undefined,
    options: Record<string, any>,
): Promise<{ tableData: ImportTableData; original: string; uploadedUri?: string }> {
    const normalizedInput = typeof input === "string" && input.trim() !== "" ? input.trim() : "-";

    if (normalizedInput.startsWith("gs://") || normalizedInput.startsWith("s3://")) {
        return {
            original: normalizedInput,
            tableData: {
                source: "gcs",
                uri: normalizedInput,
                format: normalizeFormat(options.format, normalizedInput),
            },
        };
    }

    if (normalizedInput.startsWith("http://") || normalizedInput.startsWith("https://")) {
        return {
            original: normalizedInput,
            tableData: {
                source: "url",
                uri: normalizedInput,
                format: normalizeFormat(options.format, normalizedInput),
            },
        };
    }

    const uploadName = resolveUploadName(normalizedInput, options.name);
    const format = normalizeFormat(options.format, uploadName);
    const uploadPath = buildImportUploadPath(uploadName, options);
    const mimeType = options.mime || mime.getType(uploadName) || "application/octet-stream";
    const source = normalizedInput === "-"
        ? new NodeStreamSource(process.stdin, uploadName, mimeType, uploadPath)
        : new NodeStreamSource(createReadStream(resolve(normalizedInput)), uploadName, mimeType, uploadPath);
    const uploadedUri = await client.files.uploadFile(source);

    return {
        original: normalizedInput,
        uploadedUri,
        tableData: {
            source: "gcs",
            uri: uploadedUri,
            format,
        },
    };
}

function resolveUploadName(input: string, explicitName: unknown): string {
    if (typeof explicitName === "string" && explicitName.trim() !== "") {
        return basename(explicitName.trim());
    }

    if (input === "-") {
        console.error("Error: --name is required when importing from stdin.");
        process.exit(1);
    }

    return basename(input);
}

function buildImportUploadPath(name: string, options: Record<string, any>): string {
    const prefix = typeof options.prefix === "string" && options.prefix.trim() !== ""
        ? options.prefix.trim().replace(/^\/+|\/+$/g, "")
        : `imports/${getArtifactStorageId(options)}`;
    return `${prefix}/${Date.now()}-${randomUUID()}-${name}`;
}

function buildImportMessage(tableName: string, original: string, explicitMessage: unknown): string {
    if (typeof explicitMessage === "string" && explicitMessage.trim() !== "") {
        return explicitMessage.trim();
    }
    return `Import ${original} into ${tableName} via vertesia CLI`;
}
