import { QueryResult, VertesiaClient } from "@vertesia/client";
import { NodeStreamSource } from "@vertesia/client/node";
import {
    ComplexSearchPayload,
    ContentObject,
    ContentObjectItem,
    ContentObjectTypeItem,
    CreateContentObjectPayload,
    ObjectSearchPayload,
} from "@vertesia/common";
import { Command } from "commander";
import enquirer from "enquirer";
import { Stats, createReadStream, createWriteStream, type Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { glob } from 'glob';
import mime from "mime";
import { basename, join, resolve } from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { getClient } from "../client.js";
const { prompt } = enquirer;

const AUTOMATIC_TYPE_SELECTION = "auto";
const AUTOMATIC_TYPE_SELECTION_DESC = "Auto (Vertesia will analyze the file and select the most appropriate type)";
const TYPE_SELECTION_ERROR = "TypeSelectionError";

interface JsonOutputOptions {
    json?: boolean;
}

interface ListObjectsOptions extends JsonOutputOptions {
    limit?: string;
    skip?: string;
}

interface SearchObjectsOptions extends JsonOutputOptions {
    limit?: string;
    type?: string;
    path?: string;
    select?: string;
}

interface QueryObjectsOptions extends JsonOutputOptions {
    dsl?: string;
}

function splitInChunksWithSize<T>(arr: Array<T>, size: number): T[][] {
    if (size < 1) {
        return [];
    }
    const chunks: T[][] = [];
    const len = arr.length;
    let i = 0;
    while (i < len) {
        chunks.push(arr.slice(i, i + size));
        i += size;
    }
    return chunks;
}

function splitInChunks<T>(arr: Array<T>, chunksCount: number): T[][] {
    if (arr.length < 1) {
        return [];
    }
    if (chunksCount <= arr.length) {
        const size = Math.ceil(arr.length / chunksCount);
        return splitInChunksWithSize(arr, size);
    } else {
        return [arr];
    }
}

async function listFilesInDirectory(dir: string, recursive = false): Promise<string[]> {
    return await readdir(dir, {
        withFileTypes: true,
        recursive,
    }).then((entries: Dirent[]) => entries.filter(ent => {
        // exclude hidden files and include only file with extensions
        return ent.isFile() && ent.name.lastIndexOf('.') > 0;
    }).map(ent => {
        // In Node.js 22+, use parentPath; fallback to dir for older versions
        const parentPath = 'parentPath' in ent ? (ent as Dirent & { parentPath: string }).parentPath : dir;
        return join(parentPath, ent.name);
    }));
}

export async function createObject(program: Command, files: string[], options: Record<string, any>) {
    if (files.length === 0) {
        return "No files specified"
    } else if (files.length > 1) {
        const types: any[] = await listTypes(program);
        const questions: any[] = [];
        if (!options.type) {
            questions.push({
                type: 'select',
                name: 'type',
                message: "Select a Type",
                choices: types,
                limit: 10,
                result() {
                    return this.focused.value;
                }
            });
            const response: any = await prompt(questions);
            options.type = response.type;
        } else {
            const searchedType = findTypeValue(types, options.type);
            if (searchedType === TYPE_SELECTION_ERROR) {
                console.error(`${options.type} is not an existing type`);
                process.exit(2);
            }
            options.type = searchedType;
        }

        if (options.type === AUTOMATIC_TYPE_SELECTION) {
            delete options.type;
        }
        return createObjectFromFiles(program, files, options);
    } else {
        let file = files[0];
        if (file.indexOf('*') > -1) {
            const files = await glob(file);
            return createObjectFromFiles(program, files, options);
        } else if (file.includes("://")) {
            return createObjectFromExternalSource(await getClient(program), file, options);
        } else {
            file = resolve(file);
            let stats: Stats;
            try {
                stats = await stat(file);
            } catch (err: any) {
                if (err.code === 'ENOENT') {
                    console.error('No such file or directory: ', file);
                    process.exit(2);
                }
                console.error(err);
                process.exit(2);
            }

            const types: any[] = await listTypes(program);
            const questions: any[] = [];
            if (stats.isFile()) {
                if (!options.type) {
                    questions.push({
                        type: 'select',
                        name: 'type',
                        message: "Select a Type",
                        choices: types,
                        limit: 10,
                        result() {
                            return this.focused.value;
                        }
                    });
                    const response: any = await prompt(questions);
                    options.type = response.type;
                } else {
                    const searchedType = findTypeValue(types, options.type);
                    if (searchedType === TYPE_SELECTION_ERROR) {
                        console.error(`${options.type} is not an existing type`);
                        process.exit(2);
                    }
                    options.type = searchedType;
                }

                if (options.type === AUTOMATIC_TYPE_SELECTION) {
                    delete options.type;
                }

                return createObjectFromFile(program, file, options);
            } else if (stats.isDirectory()) {
                questions.push({
                    type: 'select',
                    name: 'type',
                    message: "Select a Type (the type will be used for all the files in the directory)",
                    choices: types,
                    limit: 10,
                    result() {
                        return this.focused.value;
                    }
                });
                const response: any = await prompt(questions);
                options.type = response.type;

                if (options.type === AUTOMATIC_TYPE_SELECTION) {
                    delete options.type;
                }

                const files = await listFilesInDirectory(file, options.recursive || false);
                return createObjectFromFiles(program, files, options);
            }
        }
    }
}

export async function createObjectFromFiles(program: Command, files: string[], options: Record<string, any>) {
    if (!options) options = {};
    // split in 10 chunks
    const chunks = splitInChunks(files, 10);
    Promise.all(chunks.map(async (chunk) => {
        for (const file of chunk) {
            await createObjectFromFile(program, file, options);
        }
    }));
}

export async function createObjectFromFile(program: Command, file: string, options: Record<string, any>) {
    const client = await getClient(program);
    let res: ContentObject;
    if (file.startsWith("s3://") || file.startsWith("gs://")) {
        res = await createObjectFromExternalSource(client, file, options);
    } else {
        res = await createObjectFromLocalFile(client, file, options);
    }
    console.log('Created object', res.id);
    return res;
}

export async function createObjectFromLocalFile(client: VertesiaClient, file: string, options: Record<string, any>) {
    const fileName = basename(file);
    const stream = createReadStream(file);

    const content = new NodeStreamSource(stream, fileName);
    const mime_type = mime.getType(file);
    if (mime_type) {
        content.type = mime_type;
    }

    const res = await client.objects.create({
        name: options.name || fileName,
        type: options.type,
        location: options.path,
        content: content,
    });

    return res;
}

async function createObjectFromExternalSource(client: VertesiaClient, uri: string, options: Record<string, any>) {
    return client.objects.createFromExternalSource(uri, {
        name: options.name,
        type: options.type,
        location: options.path,
    });
}

export async function updateObject(program: Command, objectId: string, type: string, _options: Record<string, any>) {
    const types: any[] = await listTypes(program);
    let searchedType = findTypeValue(types, type);
    if (searchedType === TYPE_SELECTION_ERROR) {
        console.error(`${type} is not an existing type`);
        process.exit(2);
    }
    if (searchedType === AUTOMATIC_TYPE_SELECTION) {
        searchedType = undefined;
    }
    const payload: Partial<CreateContentObjectPayload> = { type: searchedType };
    const client = await getClient(program);
    console.log(await client.objects.update(objectId, payload));
}

export async function deleteObject(program: Command, objectId: string, _options: Record<string, any>) {
    const client = await getClient(program);
    await client.objects.delete(objectId);
}

export async function getObject(program: Command, objectId: string, _options: Record<string, any>) {
    const client = await getClient(program);
    const object = await client.objects.retrieve(objectId);
    console.log(object);
}

export async function getObjectText(program: Command, objectId: string, options: JsonOutputOptions) {
    const client = await getClient(program);
    const text = await client.objects.getObjectText(objectId);
    if (options.json) {
        printJson(text);
        return;
    }
    console.log(text.text);
}

export async function listObjects(program: Command, folderPath: string | undefined, options: ListObjectsOptions) {
    const client = await getClient(program);
    const payload: ObjectSearchPayload = {
        limit: readOptionalIntegerOption(options.limit),
        offset: readOptionalIntegerOption(options.skip),
    };
    if (folderPath) {
        payload.query = { location: folderPath };
    }
    const objects = await client.objects.list(payload);
    if (options.json) {
        printJson(objects);
        return;
    }
    printObjectItems(objects);
}

export async function searchObjects(program: Command, query: string, options: SearchObjectsOptions) {
    const client = await getClient(program);
    const payload: ComplexSearchPayload = {
        limit: readOptionalIntegerOption(options.limit) ?? 20,
        select: options.select,
        query: {
            full_text: query,
            ...(options.type ? { type: options.type } : {}),
            ...(options.path ? { location: options.path } : {}),
        },
    };
    const results = await client.objects.search(payload);
    if (options.json) {
        printJson(results);
        return;
    }
    printObjectItems(results.results);
    if (results.facets.total !== undefined) {
        console.error(`Found ${results.facets.total} results`);
    }
}

export async function queryObjects(program: Command, options: QueryObjectsOptions) {
    const payload = readQueryPayload(options);
    const client = await getClient(program);
    const result = await client.store.query.execute(payload);
    if (options.json) {
        printJson(result);
        return;
    }
    printQueryResult(result);
}

export async function listTypes(program: Command) {
    const types: any[] = []
    types.push({ name: AUTOMATIC_TYPE_SELECTION_DESC, value: AUTOMATIC_TYPE_SELECTION })

    const client = await getClient(program);
    const platformTypes: ContentObjectTypeItem[] = await client.types.list();
    for (const type of platformTypes) {
        types.push({ name: type.name, value: type.id });
    }
    return types;
}

export function findTypeValue(types: any[], name: string) {
    const type = types.find(type => type.name === name || type.id === name);
    return type ? type.value : TYPE_SELECTION_ERROR;
}

export async function downloadObjectContent(program: Command, objectId: string, options: Record<string, any>) {
    const client = await getClient(program);

    // Get object to find content source and name
    const object = await client.objects.retrieve(objectId);
    const contentSource = await client.objects.getContentSource(objectId);

    if (!contentSource?.source) {
        console.error("Object has no downloadable content");
        process.exit(1);
    }

    // Get download URL and stream content
    const { url } = await client.files.getDownloadUrl(contentSource.source);
    const response = await fetch(url);

    if (!response.ok || !response.body) {
        console.error(`Failed to download: ${response.statusText}`);
        process.exit(1);
    }

    const outputPath = options.output || object.name;
    const nodeStream = Readable.fromWeb(response.body as any);
    const writeStream = createWriteStream(outputPath);
    await pipeline(nodeStream, writeStream);

    console.log(`Downloaded to: ${outputPath}`);
}

function readOptionalIntegerOption(value: string | undefined): number | undefined {
    if (value === undefined || value === "") {
        return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
        console.error(`Invalid numeric option: ${value}`);
        process.exit(2);
    }
    return parsed;
}

function readQueryPayload(options: QueryObjectsOptions): { dsl: Record<string, unknown> } {
    if (!options.dsl) {
        console.error("Specify --dsl with a JSON object.");
        process.exit(2);
    }
    try {
        const dsl = JSON.parse(options.dsl ?? "");
        if (!isRecord(dsl)) {
            console.error("Invalid JSON for --dsl: expected a JSON object.");
            process.exit(2);
        }
        return { dsl };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Invalid JSON for --dsl: ${message}`);
        process.exit(2);
    }
}

function printJson(value: unknown) {
    console.log(JSON.stringify(value, null, 2));
}

function printObjectItems(objects: ContentObjectItem[]) {
    if (objects.length === 0) {
        console.log("No objects found");
        return;
    }
    console.log(
        objects
            .map((object) => {
                const typeName = readObjectTypeName(object);
                const location = object.location ?? "";
                const status = object.status ?? "";
                return [object.id, object.name, typeName, status, location].join("\t");
            })
            .join("\n"),
    );
}

function readObjectTypeName(object: ContentObjectItem): string {
    if (!object.type) {
        return "";
    }
    if (typeof object.type === "string") {
        return object.type;
    }
    return object.type.name || object.type.id || object.type.code || "";
}

function printQueryResult(result: QueryResult) {
    if (result.type === "dsl") {
        if (!result.hits || result.hits.length === 0) {
            console.log("No hits");
            return;
        }
        console.log(
            result.hits
                .map((hit) => JSON.stringify({
                    id: hit.id,
                    score: hit.score,
                    source: hit.source,
                }))
                .join("\n"),
        );
        return;
    }

    const columns = result.columns?.map((column) => column.name) ?? [];
    const rows = result.rows ?? [];
    if (columns.length > 0) {
        console.log(columns.join("\t"));
    }
    if (rows.length === 0) {
        if (columns.length === 0) {
            console.log("No rows");
        }
        return;
    }
    console.log(
        rows
            .map((row) => row.map((value) => formatQueryValue(value)).join("\t"))
            .join("\n"),
    );
}

function formatQueryValue(value: unknown): string {
    if (value === null || value === undefined) {
        return "";
    }
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
