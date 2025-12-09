import { Command } from "commander";
import { createReadStream, createWriteStream } from "fs";
import { basename } from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { NodeStreamSource } from "@vertesia/client/node";
import { getClient } from "../client.js";

// Artifact storage prefix - matches the client's ARTIFACTS_PREFIX
const ARTIFACTS_PREFIX = "agents";

/**
 * Get run ID from options or environment variable
 */
function getRunId(options: Record<string, any>): string {
    const runId = options.runId || process.env.VERTESIA_RUN_ID;
    if (!runId) {
        console.error("Error: Run ID not specified. Use --run-id or set VERTESIA_RUN_ID env var");
        process.exit(1);
    }
    return runId;
}

export async function uploadArtifact(program: Command, file: string | undefined, options: Record<string, any>) {
    const client = await getClient(program);
    const runId = getRunId(options);

    let stream: Readable;
    let name: string;

    if (!file || file === '-') {
        // Read from stdin
        if (!options.name) {
            console.error("Error: --name is required when uploading from stdin");
            process.exit(1);
        }
        stream = process.stdin;
        name = options.name;
    } else {
        stream = createReadStream(file);
        name = options.name || basename(file);
    }

    const source = new NodeStreamSource(stream, name, options.mime);
    const result = await client.files.uploadArtifact(runId, name, source);
    console.log(`Uploaded artifact: ${result}`);
}

export async function downloadArtifact(program: Command, name: string, options: Record<string, any>) {
    const client = await getClient(program);
    const runId = getRunId(options);

    const stream = await client.files.downloadArtifact(runId, name);

    if (options.output) {
        const nodeStream = Readable.fromWeb(stream as any);
        const writeStream = createWriteStream(options.output);
        await pipeline(nodeStream, writeStream);
        console.log(`Downloaded to: ${options.output}`);
    } else {
        // Stream to stdout
        const nodeStream = Readable.fromWeb(stream as any);
        await pipeline(nodeStream, process.stdout);
    }
}

export async function listArtifacts(program: Command, options: Record<string, any>) {
    const client = await getClient(program);
    const runId = getRunId(options);

    const artifacts = await client.files.listArtifacts(runId);
    // Show filenames only, strip the agents/{runId}/ prefix
    const prefix = `${ARTIFACTS_PREFIX}/${runId}/`;
    artifacts.forEach(a => {
        const filename = a.startsWith(prefix) ? a.slice(prefix.length) : a;
        console.log(filename);
    });
}

export async function getArtifactUrl(program: Command, name: string, options: Record<string, any>) {
    const client = await getClient(program);
    const runId = getRunId(options);

    const { url } = await client.files.getArtifactDownloadUrl(runId, name);
    console.log(url);
}
