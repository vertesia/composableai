import { VertesiaClient } from "@vertesia/client";
import { NodeStreamSource } from "@vertesia/client/node";
import { Command } from "commander";
import { createReadStream } from "fs";
import { getClient } from "../client.js";

export function getPublishMemoryAction(program: Command) {
    return (file: string, name: string) => {
        const client = getClient(program);
        return publishMemory(client, file, name);
    }
}

async function publishMemory(client: VertesiaClient, file: string, name: string) {
    const stream = createReadStream(file);
    const path = await client.files.uploadMemoryPack(new NodeStreamSource(stream,
        name,
        "application/gzip"
    ));
    return path;
}
