import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { CRC32C } from '@google-cloud/storage';
import type { GcsResumableUploadSession } from '@vertesia/common';
import { afterEach, describe, expect, it } from 'vitest';
import { uploadGcsResumable } from './node-sessions.js';

/** What the fake session does with the chunk PUT it fails: lose its bytes, or persist them and lose the reply. */
type Failure = 'drop' | 'keep';

interface FakeSession {
    url: string;
    stored: () => Buffer;
    /** One line per request: the `Content-Range` header and the status sent back. */
    requests: string[];
}

/**
 * A GCS resumable session, as its upload protocol describes it: a chunk PUT carries `Content-Range: bytes a-b/total`
 * (total `*` until the last chunk) and gets 308 with the persisted `Range` until the object is complete, then 200 with
 * its metadata. A PUT of `bytes *\/*` with no body asks for the status the same way. The `failChunk`-th chunk PUT
 * gets a 503.
 */
async function startFakeSession(server: Server, failChunk: number, failure: Failure): Promise<FakeSession> {
    let stored = Buffer.alloc(0);
    let chunks = 0;
    let completed: number | undefined;
    const requests: string[] = [];

    function reply(res: ServerResponse, range: string, status: number, total?: number) {
        requests.push(`${range} -> ${status}`);
        if (status === 200 && total !== undefined && stored.length === total) {
            const crc32c = new CRC32C();
            crc32c.update(stored);
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(
                JSON.stringify({
                    name: 'dir/big.bin',
                    bucket: 'bucket',
                    size: String(total),
                    md5Hash: createHash('md5').update(stored).digest('base64'),
                    crc32c: crc32c.toString(),
                }),
            );
            return;
        }
        if (status === 308) {
            res.writeHead(308, stored.length ? { range: `bytes=0-${stored.length - 1}` } : {});
            res.end();
            return;
        }
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { code: status, message: 'Service Unavailable' } }));
    }

    async function handle(req: IncomingMessage, res: ServerResponse) {
        const body: Buffer[] = [];
        for await (const chunk of req) body.push(chunk as Buffer);
        const data = Buffer.concat(body);
        const range = req.headers['content-range'] ?? '';
        const match = /^bytes (\*|(\d+)-(\d+))\/(\*|\d+)$/.exec(range);
        if (req.method !== 'PUT' || !match) {
            reply(res, range, 400);
            return;
        }
        const total = match[4] === '*' ? undefined : Number(match[4]);
        if (match[1] === '*') {
            const size = completed ?? total;
            reply(res, range, size !== undefined && stored.length === size ? 200 : 308, size);
            return;
        }
        const start = Number(match[2]);
        if (start > stored.length) {
            reply(res, range, 400);
            return;
        }
        chunks++;
        const failed = chunks === failChunk;
        if (!failed || failure === 'keep') {
            stored = Buffer.concat([stored.subarray(0, start), data]);
            if (total !== undefined && stored.length === total) completed = total;
        }
        if (failed) {
            reply(res, range, 503);
            return;
        }
        reply(res, range, total !== undefined && stored.length === total ? 200 : 308, total);
    }

    server.on('request', (req, res) => {
        handle(req, res).catch((err: unknown) => res.destroy(err as Error));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    return { url: `http://127.0.0.1:${port}/upload/session`, stored: () => stored, requests };
}

const PART_SIZE = 256 * 1024;

describe('uploadGcsResumable', () => {
    let server: Server | undefined;

    afterEach(async () => {
        if (server?.listening) {
            server.close();
            await once(server, 'close');
        }
        server = undefined;
    });

    // Not covered: a final chunk the session persisted but whose reply was lost. The SDK reads the completed session
    // as offset 0 and fails the upload with a RangeError instead of finishing it.
    it.each<{ chunk: number; failure: Failure }>([
        { chunk: 2, failure: 'drop' },
        { chunk: 2, failure: 'keep' },
        { chunk: 3, failure: 'drop' },
    ])(
        'resends chunk $chunk of 3 after a 503 (bytes $failure) and completes the upload',
        async ({ chunk, failure }) => {
            server = createServer();
            const fake = await startFakeSession(server, chunk, failure);
            const content = randomBytes(PART_SIZE * 2 + 1000);
            const session: GcsResumableUploadSession = {
                protocol: 'gcs_resumable',
                id: 'gs://bucket/dir/big.bin',
                path: 'bucket/dir/big.bin',
                mime_type: 'application/octet-stream',
                part_size: PART_SIZE,
                url: fake.url,
            };

            const md5 = await uploadGcsResumable(session, { body: new Blob([content]), size: content.length });

            expect(fake.requests.filter((line) => line.endsWith('-> 503'))).toHaveLength(1);
            expect(fake.stored().equals(content)).toBe(true);
            expect(md5).toBe(createHash('md5').update(content).digest('hex'));
        },
        20_000,
    );
});
