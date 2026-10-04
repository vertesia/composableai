import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

export const CANONICAL_TEXT_EXTRACTION_LIMITS = Object.freeze({
    input_bytes: 50 * 1024 * 1024,
    output_bytes: 2 * 1024 * 1024,
    pages: 500,
    deadline_ms: 30_000,
    decoder_metadata_bytes: 64 * 1024,
});

export class CanonicalTextExtractionError extends Error {
    constructor(
        readonly reason:
            | 'unsupported_format'
            | 'invalid_document'
            | 'limit_exceeded'
            | 'deadline_exceeded'
            | 'cancelled',
        options?: ErrorOptions,
    ) {
        super(`Canonical text extraction ${reason}`, options);
        this.name = 'CanonicalTextExtractionError';
    }
}

export interface CanonicalTextExtractionOptions {
    signal?: AbortSignal;
    /** Trusted activity heartbeat; never receives document content. */
    heartbeat?: (progress: { stage: 'inspect' | 'extract'; elapsed_ms: number }) => void;
}

export interface CanonicalTextExtractionResult {
    text: string;
    backend: { id: 'utf8' | 'mutool'; version: string };
    pages?: number;
}

/** One direct child, bounded captured output, no shell, and no unbounded stderr accumulation. */
function decodePdfCommand(
    args: readonly string[],
    maxBytes: number,
    deadline: number,
    options: CanonicalTextExtractionOptions,
    stage: 'inspect' | 'extract',
    captureStderr = false,
): Promise<Buffer> {
    options.signal?.throwIfAborted();
    if (performance.now() >= deadline) return Promise.reject(new CanonicalTextExtractionError('deadline_exceeded'));
    return new Promise((resolve, reject) => {
        const child = spawn('mutool', [...args], { stdio: ['ignore', 'pipe', 'pipe'] });
        const chunks: Buffer[] = [];
        let bytes = 0;
        let chunkCount = 0;
        let stderrBytes = 0;
        let discardedStdoutBytes = 0;
        let settled = false;
        const started = performance.now();
        const finish = (error?: unknown) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            clearInterval(heartbeat);
            options.signal?.removeEventListener('abort', cancel);
            if (error !== undefined) {
                child.kill('SIGKILL');
                child.stdout.destroy();
                child.stderr.destroy();
                reject(error);
            } else resolve(Buffer.concat(chunks, bytes));
        };
        const cancel = () => finish(new CanonicalTextExtractionError('cancelled', { cause: options.signal?.reason }));
        const timer = setTimeout(
            () => finish(new CanonicalTextExtractionError('deadline_exceeded')),
            Math.max(0, deadline - performance.now()),
        );
        const heartbeat = setInterval(() => {
            try {
                options.heartbeat?.({ stage, elapsed_ms: Math.floor(performance.now() - started) });
            } catch (error) {
                finish(error);
            }
        }, 1_000);
        options.signal?.addEventListener('abort', cancel, { once: true });
        if (options.signal?.aborted) cancel();
        child.stdout.on('data', (data: Buffer) => {
            const chunk = Buffer.from(data);
            if (settled) return;
            if (captureStderr) {
                discardedStdoutBytes += chunk.byteLength;
                if (discardedStdoutBytes > CANONICAL_TEXT_EXTRACTION_LIMITS.decoder_metadata_bytes)
                    finish(new CanonicalTextExtractionError('limit_exceeded'));
                return;
            }
            bytes += chunk.byteLength;
            chunkCount += 1;
            if (bytes > maxBytes || chunkCount > 65_536) finish(new CanonicalTextExtractionError('limit_exceeded'));
            else chunks.push(Buffer.from(chunk));
        });
        child.stderr.on('data', (data: Buffer) => {
            const chunk = Buffer.from(data);
            if (settled) return;
            stderrBytes += chunk.byteLength;
            if (captureStderr) {
                bytes += chunk.byteLength;
                chunkCount += 1;
                if (bytes > maxBytes || chunkCount > 65_536) finish(new CanonicalTextExtractionError('limit_exceeded'));
                else chunks.push(Buffer.from(chunk));
            }
            if (stderrBytes > CANONICAL_TEXT_EXTRACTION_LIMITS.decoder_metadata_bytes)
                finish(new CanonicalTextExtractionError('limit_exceeded'));
        });
        child.on('error', (cause) => finish(new CanonicalTextExtractionError('invalid_document', { cause })));
        child.on('close', (code) => {
            if (code !== 0) finish(new CanonicalTextExtractionError('invalid_document'));
            else if (options.signal?.aborted) cancel();
            else if (performance.now() >= deadline) finish(new CanonicalTextExtractionError('deadline_exceeded'));
            else finish();
        });
    });
}

/** Exact owned bytes only. This helper creates no asset identity, publication, token count or receipt. */
export async function extractCanonicalTextFromBuffer(
    input: Uint8Array,
    mimeType: string,
    options: CanonicalTextExtractionOptions = {},
): Promise<CanonicalTextExtractionResult> {
    const signal = options.signal;
    const heartbeat = options.heartbeat;
    if (heartbeat !== undefined && typeof heartbeat !== 'function') throw new TypeError('Invalid extraction heartbeat');
    const ownedOptions = { signal, heartbeat };
    signal?.throwIfAborted();
    if (!(input instanceof Uint8Array) || input.byteLength > CANONICAL_TEXT_EXTRACTION_LIMITS.input_bytes)
        throw new CanonicalTextExtractionError('limit_exceeded');
    if (typeof mimeType !== 'string') throw new TypeError('Extraction MIME type must be a string');
    const bytes = Buffer.from(input);
    const deadline = performance.now() + CANONICAL_TEXT_EXTRACTION_LIMITS.deadline_ms;
    if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
        if (bytes.byteLength > CANONICAL_TEXT_EXTRACTION_LIMITS.output_bytes)
            throw new CanonicalTextExtractionError('limit_exceeded');
        let text: string;
        try {
            text = new TextDecoder('utf8', { fatal: true, ignoreBOM: true }).decode(bytes);
        } catch (cause) {
            throw new CanonicalTextExtractionError('invalid_document', { cause });
        }
        signal?.throwIfAborted();
        return { text, backend: { id: 'utf8', version: '1' } };
    }
    if (mimeType !== 'application/pdf') throw new CanonicalTextExtractionError('unsupported_format');
    if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw new CanonicalTextExtractionError('invalid_document');
    const directory = mkdtempSync(join(tmpdir(), 'vertesia-canonical-extract-'));
    try {
        const path = join(directory, 'input.pdf');
        writeFileSync(path, bytes, { mode: 0o600 });
        signal?.throwIfAborted();
        const versionBytes = await decodePdfCommand(['-v'], 1024, deadline, ownedOptions, 'inspect', true);
        const version = versionBytes.toString('utf8').trim();
        if (!/^mutool version \d+\.\d+(?:\.\d+)?$/.test(version))
            throw new CanonicalTextExtractionError('invalid_document');
        const info = await decodePdfCommand(
            ['info', path, '1'],
            CANONICAL_TEXT_EXTRACTION_LIMITS.decoder_metadata_bytes,
            deadline,
            ownedOptions,
            'inspect',
        );
        const counts = [...info.toString('utf8').matchAll(/^Pages:\s*([0-9]+)\s*$/gm)];
        if (counts.length !== 1) throw new CanonicalTextExtractionError('invalid_document');
        const pages = Number(counts[0][1]);
        if (!Number.isSafeInteger(pages) || pages < 1) throw new CanonicalTextExtractionError('invalid_document');
        if (pages > CANONICAL_TEXT_EXTRACTION_LIMITS.pages) throw new CanonicalTextExtractionError('limit_exceeded');
        const output = await decodePdfCommand(
            ['draw', '-F', 'txt', '-q', path, `1-${pages}`],
            CANONICAL_TEXT_EXTRACTION_LIMITS.output_bytes,
            deadline,
            ownedOptions,
            'extract',
        );
        let text: string;
        try {
            text = new TextDecoder('utf8', { fatal: true, ignoreBOM: true }).decode(output);
        } catch (cause) {
            throw new CanonicalTextExtractionError('invalid_document', { cause });
        }
        signal?.throwIfAborted();
        return { text, backend: { id: 'mutool', version }, pages };
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}
