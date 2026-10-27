import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withTemporalDownloadRetry } from './temporal-environment.mjs';

const url = 'for url (https://temporal.download/assets/temporal-test-server)';

describe('withTemporalDownloadRetry', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    async function runOnce(message: string) {
        const create = vi.fn().mockRejectedValueOnce(new Error(message)).mockResolvedValue('env');
        const result = withTemporalDownloadRetry(create).catch((error: unknown) => error);
        await vi.runAllTimersAsync();
        return { result: await result, calls: create.mock.calls.length };
    }

    it.each([
        `HTTP status server error (503 Service Unavailable) ${url}`,
        `HTTP status client error (429 Too Many Requests) ${url}`,
        'Failed to download test server: error decoding response body',
        'error sending request: connection error: Connection reset by peer (os error 104)',
        'could not extract tar archive: failed to unpack `temporal-test-server`',
    ])('retries a transient download failure: %s', async (message) => {
        await expect(runOnce(message)).resolves.toEqual({ result: 'env', calls: 2 });
    });

    it.each([
        `HTTP status client error (404 Not Found) ${url}`,
        'Failed to start ephemeral server: address already in use',
    ])('rethrows a non-transient failure: %s', async (message) => {
        const { result, calls } = await runOnce(message);
        expect(result).toBeInstanceOf(Error);
        expect((result as Error).message).toBe(message);
        expect(calls).toBe(1);
    });

    it('gives up after the configured retries', async () => {
        const create = vi.fn().mockRejectedValue(new Error('error decoding response body'));
        const result = withTemporalDownloadRetry(create, 2).catch((error: unknown) => error);
        await vi.runAllTimersAsync();
        expect(await result).toBeInstanceOf(Error);
        expect(create).toHaveBeenCalledTimes(3);
    });
});
