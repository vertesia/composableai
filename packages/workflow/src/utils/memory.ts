import { VertesiaClient } from "@vertesia/client";
import { NodeStreamSource } from "@vertesia/client/node";
import { Commands, MemoryPack, buildMemoryPack as _buildMemoryPack, loadMemoryPack as _loadMemoryPack } from "@vertesia/memory";
import { createReadStream, createWriteStream } from "fs";
import { rm } from "fs/promises";
import { webStreamToReadable } from "node-web-stream-adapters";
import { pipeline } from "stream/promises";

import tmp from "tmp";
import zlib from "zlib";

tmp.setGracefulCleanup();


export async function publishMemoryPack(client: VertesiaClient, file: string, name: string): Promise<void> {
    const stream = createReadStream(file);
    try {
        const source = new NodeStreamSource(stream, name);
        await client.files.uploadMemoryPack(source);
    } catch (err: any) {
        stream.destroy();
        throw err;
    }
}

export async function buildMemoryPack(recipeFn: (commands: Commands) => Promise<Record<string, any>>): Promise<string> {
    const tarFile = tmp.fileSync({
        prefix: "composable-memory-pack-",
        postfix: ".tar.gz",
    });
    return await _buildMemoryPack(recipeFn, {
        out: tarFile.name,
        gzip: true,
    });
}

export async function buildAndPublishMemoryPack(client: VertesiaClient, name: string, recipeFn: (commands: Commands) => Promise<Record<string, any>>): Promise<void> {
    const tarFile = await buildMemoryPack(recipeFn);
    try {
        await publishMemoryPack(client, tarFile, name);
    } finally {
        await rm(tarFile);
    }
}

export async function fetchMemoryPack(client: VertesiaClient, name: string): Promise<string> {
    const webStream = await client.files.downloadMemoryPack(name);
    const tarFile = tmp.fileSync({
        prefix: "composable-memory-pack-",
        postfix: ".tar",
        discardDescriptor: true,
    });
    const streamIn = webStreamToReadable(webStream);
    const streamOut = createWriteStream(tarFile.name);
    await pipeline(streamIn, zlib.createGunzip(), streamOut);
    return tarFile.name;
}

export function loadMemoryPack(client: VertesiaClient, name: string): Promise<MemoryPack> {
    return fetchMemoryPack(client, name).then(file => _loadMemoryPack(file));
}
