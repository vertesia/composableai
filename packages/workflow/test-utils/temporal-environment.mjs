// Temporal test environments whose server binary download is cached on disk and retried.
//
// `TestWorkflowEnvironment.createLocal()` and `createTimeSkipping()` download the server binary from
// temporal.download into a temp directory when none is configured, and @temporalio/testing exposes no retry
// setting. A momentary 5xx/429, or a connection dropped mid-body (a reqwest body error, a reset socket, or a
// truncated archive that cannot be extracted), then fails the whole suite. These helpers download into
// `.cache/test-binaries`, which CI caches and `prewarm-temporal.mjs` fills before the tests run, and retry
// the transient failures.
//
// Plain ESM so that the prewarm script can run it under `node` without a TypeScript loader.
import fs from 'node:fs';
import path from 'node:path';
import temporalTesting from '@temporalio/testing';

const { TestWorkflowEnvironment } = temporalTesting;

const binaryDir = path.resolve(import.meta.dirname, '..', '.cache', 'test-binaries');
// The time-skipping test server and the CLI used by the local dev server are different binaries.
const TEST_SERVER_DIR = path.join(binaryDir, 'temporal');
const CLI_DIR = path.join(binaryDir, 'temporal-cli');

// 408 Request Timeout, 425 Too Early, 429 Too Many Requests, 500/502/503/504 server-side transients.
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
// A transfer cut off after the response headers: reqwest's body error, a reset socket, or a truncated archive.
const RETRYABLE_MESSAGE = /error decoding response body|connection reset|could not extract tar archive/i;

/**
 * Describes a retryable Temporal binary download failure, or returns `undefined` when the error is not one.
 * The SDK surfaces HTTP failures as e.g. `... HTTP status server error (503 Service Unavailable) for url (...)`.
 */
export function retryableDownloadFailure(error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = Number(message.match(/HTTP status[^(]*\((\d{3})/)?.[1]);
    if (RETRYABLE_STATUS.has(status)) {
        return `HTTP ${status}`;
    }
    return message.match(RETRYABLE_MESSAGE)?.[0];
}

/**
 * Runs `create`, retrying with exponential backoff when it fails with a retryable Temporal binary download
 * failure. Other errors and exhausted retries are rethrown.
 */
export async function withTemporalDownloadRetry(create, retries = 3) {
    for (let attempt = 0; ; attempt += 1) {
        try {
            return await create();
        } catch (error) {
            const failure = retryableDownloadFailure(error);
            if (failure === undefined || attempt >= retries) {
                throw error;
            }
            const delayMs = 1000 * 2 ** attempt;
            console.warn(
                `[temporal] server binary download failed (${failure}); ` +
                    `retrying in ${delayMs}ms (attempt ${attempt + 1}/${retries})`,
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
}

function cachedDownload(downloadDir) {
    fs.mkdirSync(downloadDir, { recursive: true });
    return { executable: { type: 'cached-download', downloadDir } };
}

export function createLocalTestEnvironment() {
    return withTemporalDownloadRetry(() => TestWorkflowEnvironment.createLocal({ server: cachedDownload(CLI_DIR) }));
}

export function createTimeSkippingTestEnvironment() {
    return withTemporalDownloadRetry(() =>
        TestWorkflowEnvironment.createTimeSkipping({ server: cachedDownload(TEST_SERVER_DIR) }),
    );
}
