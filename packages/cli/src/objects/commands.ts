import { ComposableClient, StreamSource } from "@vertesia/client";
import { ContentObject, ContentObjectTypeItem, CreateContentObjectPayload } from "@vertesia/common";
import { Command } from "commander";
import enquirer from "enquirer";
import { Dirent, Stats, createReadStream } from "fs";
import { readdir, stat } from "fs/promises";
import { glob } from 'glob';
import mime from "mime";
import { createReadableStreamFromReadable } from "node-web-stream-adapters";
import { basename, join, resolve } from "path";
import { getClient } from "../client.js";
const { prompt } = enquirer;

const AUTOMATIC_TYPE_SELECTION = "AutomaticTypeSelection";
const TYPE_SELECTION_ERROR = "TypeSelectionError";

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
    }).then((ents: Dirent[]) => ents.filter(ent => {
        // eclude hidden files and include only file with extensions
        return ent.isFile() && ent.name.lastIndexOf('.') > 0;
    }).map(ent => join(ent.path || '', ent.name)));
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
            return createObjectFromExternalSource(getClient(program), file, options);
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
    const client = getClient(program);
    let res: ContentObject;
    if (file.startsWith("s3://") || file.startsWith("gs://")) {
        res = await createObjectFromExternalSource(client, file, options);
    } else {
        res = await createObjectFromLocalFile(client, file, options);
    }
    console.log('Created object', res.id);
    return res;
}

export async function createObjectFromLocalFile(client: ComposableClient, file: string, options: Record<string, any>) {
    const fileName = basename(file);
    const stream = createReadStream(file);

    const content = new StreamSource(createReadableStreamFromReadable(stream), fileName);
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

async function createObjectFromExternalSource(client: ComposableClient, uri: string, options: Record<string, any>) {
    return client.objects.createFromExternalSource(uri, {
        name: options.name,
        type: options.type,
        location: options.path,
    });
}

export async function updateObject(program: Command, objectId: string, type: string, _options: Record<string, any>) {
    const types: any[] = await listTypes(program);
    var searchedType = findTypeValue(types, type);
    if (searchedType === TYPE_SELECTION_ERROR) {
        console.error(`${type} is not an existing type`);
        process.exit(2);
    }
    if (searchedType === AUTOMATIC_TYPE_SELECTION) {
        searchedType = undefined;
    }
    const payload: Partial<CreateContentObjectPayload> = { type: searchedType };
    console.log(await getClient(program).objects.update(objectId, payload));
}

export async function deleteObject(program: Command, objectId: string, _options: Record<string, any>) {
    await getClient(program).objects.delete(objectId);
}

export async function getObject(program: Command, objectId: string, _options: Record<string, any>) {
    const object = await getClient(program).objects.retrieve(objectId);
    console.log(object);
}

//@ts-ignore
export async function listObjects(program: Command, folderPath: string | undefined, _options: Record<string, any>) {
    const objects = await getClient(program).objects.list();
    console.log(objects.map(o => `${o.id}\t ${o.name}`).join('\n'));
}

export async function listTypes(program: Command) {
    var types: any[] = []
    types.push({ name: AUTOMATIC_TYPE_SELECTION, value: AUTOMATIC_TYPE_SELECTION })

    const platformTypes: ContentObjectTypeItem[] = await getClient(program).types.list();
    for (const type of platformTypes) {
        types.push({ name: type.name, value: type.id });
    }
    return types;
}

export function findTypeValue(types: any[], name: string) {
    const type = types.find(type => type.name === name || type.id === name);
    return type ? type.value : TYPE_SELECTION_ERROR;
}