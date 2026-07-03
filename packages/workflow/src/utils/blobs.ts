import crypto from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { VertesiaClient } from '@vertesia/client';
import tmp from 'tmp';
import { DocumentNotFoundError } from '../errors.js';

tmp.setGracefulCleanup();

export async function fetchBlobAsStream(client: VertesiaClient, blobUri: string): Promise<ReadableStream<Uint8Array>> {
    try {
        return await client.files.downloadFile(blobUri);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('not found')) {
            //TODO improve error handling with a fetch fail error class in the client
            throw new DocumentNotFoundError(`Not found at ${blobUri}: ${message}`, []);
        } else if (message.includes('forbidden')) {
            throw new DocumentNotFoundError(`Forbidden at ${blobUri}: ${message}`);
        } else {
            throw new Error(`Failed to download blob ${blobUri}: ${message}`);
        }
    }
}
export async function fetchBlobAsBuffer(client: VertesiaClient, blobUri: string): Promise<Buffer> {
    const stream = await fetchBlobAsStream(client, blobUri);
    const buffers: Uint8Array[] = [];
    for await (const data of stream) {
        buffers.push(data);
    }
    return Buffer.concat(buffers);
}

export async function fetchBlobAsBase64(client: VertesiaClient, blobUri: string): Promise<string> {
    const buffer = await fetchBlobAsBuffer(client, blobUri);
    return buffer.toString('base64');
}

async function saveBlobToFile(client: VertesiaClient, blobUri: string, toFile: string): Promise<void> {
    const stream = await fetchBlobAsStream(client, blobUri);

    const nodeReadable = Readable.from(stream);
    const out = createWriteStream(toFile);

    await pipeline(nodeReadable, out); // Ensures completion before continuing
}

export async function saveBlobToTempFile(client: VertesiaClient, blobUri: string, fileExt?: string): Promise<string> {
    const tmpFile = tmp.fileSync({
        prefix: 'vertesia-activity-',
        postfix: fileExt ? `.${fileExt}` : '',
    });
    await saveBlobToFile(client, blobUri, tmpFile.name);
    return tmpFile.name;
}

export function md5(contents: string) {
    return crypto.createHash('md5').update(contents).digest('hex');
}
