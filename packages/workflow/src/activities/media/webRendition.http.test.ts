import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { MockActivityEnvironment } from '@temporalio/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { generateRenditionWithDimensions, type MediaResult, type VideoMetadataExtended } from './video.js';

vi.mock('@temporalio/activity', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@temporalio/activity')>()),
    log: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

/**
 * The web rendition encoded by the real ffmpeg from a URL served here. In `cut` mode the server sends half of the file,
 * drops the connection, and refuses the reconnect with a 403, as a store does once a signature has expired.
 */
let dir: string;
let source: string;
let server: http.Server;
let mode: 'whole' | 'cut' = 'whole';
let requests = 0;

const DURATION_SECONDS = 4;
const metadata: VideoMetadataExtended = {
    duration: DURATION_SECONDS,
    width: 160,
    height: 120,
    codec: 'h264',
    bitrate: 1,
    fps: 30,
    hasAudio: true,
    formatName: 'mov,mp4,m4a,3gp,3g2,mj2',
    audioStreams: 1,
};

function serve(req: http.IncomingMessage, res: http.ServerResponse) {
    requests += 1;
    const size = fs.statSync(source).size;
    if (mode === 'cut' && requests > 1) {
        res.writeHead(403).end('Request has expired');
        return;
    }
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '');
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Number(range[2]) : size - 1;
    res.writeHead(range ? 206 : 200, {
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': 'video/mp4',
        ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
    });
    if (mode === 'whole') {
        fs.createReadStream(source, { start, end }).pipe(res);
        return;
    }
    const half = fs.createReadStream(source, { start, end: start + Math.floor((end - start) / 2) });
    half.pipe(res, { end: false });
    half.on('end', () => req.socket.destroy());
}

function durationOf(file: string): number {
    return Number(
        execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
            .toString()
            .trim(),
    );
}

async function encode(): Promise<MediaResult | null> {
    requests = 0;
    const outputDir = fs.mkdtempSync(path.join(dir, 'out-'));
    const { port } = server.address() as AddressInfo;
    return await new MockActivityEnvironment({ startToCloseTimeoutMs: 5 * 60_000 }).run(
        (): Promise<MediaResult | null> =>
            generateRenditionWithDimensions(
                { kind: 'url', url: `http://127.0.0.1:${port}/source.mp4?X-Signature=secret` },
                outputDir,
                metadata,
                1920,
                'ultrafast',
            ),
    );
}

beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-rendition-http-'));
    source = path.join(dir, 'source.mp4');
    execFileSync(
        'ffmpeg',
        [
            ...['-v', 'error', '-y'],
            ...['-f', 'lavfi', '-i', `testsrc=size=160x120:rate=30:duration=${DURATION_SECONDS}`],
            ...['-f', 'lavfi', '-i', `sine=frequency=440:duration=${DURATION_SECONDS}`],
            ...['-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-movflags', '+faststart', source],
        ],
        { stdio: 'ignore' },
    );
    server = http.createServer(serve);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
});

afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(dir, { recursive: true, force: true });
});

describe('web rendition over a URL, with the real ffmpeg', () => {
    it('encodes the whole source', { timeout: 60_000 }, async () => {
        mode = 'whole';
        const result = await encode();

        expect(result).not.toBeNull();
        expect(durationOf(result?.file ?? '')).toBeCloseTo(DURATION_SECONDS, 0);
    });

    // ffmpeg backs off before each reconnect, so the cut takes several seconds to fail.
    it('fails, rather than finishing a cut-short rendition, when the source breaks off mid-stream', {
        timeout: 60_000,
    }, async () => {
        mode = 'cut';
        const failure = await encode().then(
            (result) => ({ result, duration: result ? durationOf(result.file) : undefined }),
            (error: unknown) => error,
        );

        expect(failure).toBeInstanceOf(Error);
        expect(String((failure as Error).message)).not.toContain('secret');
        expect(requests).toBeGreaterThan(1);
    });
});
