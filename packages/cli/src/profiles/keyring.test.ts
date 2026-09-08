import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    deleteAuthBundle,
    isKeyringAvailable,
    readAuthBundle,
    writeAuthBundle,
    writeRefreshedAuthBundle,
} from './keyring.js';

describe('Bun native keyring', () => {
    const values = new Map<string, string>();
    const get = vi.fn(async ({ service, name }: { service: string; name: string }) => {
        return values.get(`${service}/${name}`) ?? null;
    });
    const set = vi.fn(async ({ service, name, value }: { service: string; name: string; value: string }) => {
        values.set(`${service}/${name}`, value);
    });
    const remove = vi.fn(async ({ service, name }: { service: string; name: string }) => {
        return values.delete(`${service}/${name}`);
    });

    beforeEach(() => {
        values.clear();
        vi.clearAllMocks();
        Object.defineProperty(globalThis, 'Bun', {
            configurable: true,
            value: { secrets: { get, set, delete: remove } },
        });
    });

    afterEach(() => {
        Reflect.deleteProperty(globalThis, 'Bun');
        vi.useRealTimers();
    });

    it('stores profile credentials with the Vertesia service identity', async () => {
        await writeAuthBundle('production', {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
        });

        expect(set).toHaveBeenCalledWith({
            service: 'vertesia',
            name: 'production',
            value: expect.any(String),
        });
        await expect(readAuthBundle('production')).resolves.toMatchObject({
            version: 1,
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
        });
    });

    it('retries saving the same rotated credentials after transient keychain failures', async () => {
        vi.useFakeTimers();
        set.mockRejectedValueOnce(new Error('Keychain locked')).mockRejectedValueOnce(new Error('Prompt timed out'));
        const write = writeRefreshedAuthBundle('production', { accessToken: 'access', refreshToken: 'replacement' });
        await vi.advanceTimersByTimeAsync(1500);
        await write;
        expect(set).toHaveBeenCalledTimes(3);
        expect(new Set(set.mock.calls.map(([arg]) => arg.value)).size).toBe(1);
        expect((await readAuthBundle('production'))?.refreshToken).toBe('replacement');
    });

    it('bounds persistence retries and preserves the last keychain error', async () => {
        vi.useFakeTimers();
        const error = new Error('Keychain unavailable');
        set.mockRejectedValueOnce(error).mockRejectedValueOnce(error).mockRejectedValueOnce(error);
        const write = writeRefreshedAuthBundle('production', { refreshToken: 'replacement' });
        const assertion = expect(write).rejects.toBe(error);
        await vi.advanceTimersByTimeAsync(1500);
        await assertion;
        expect(set).toHaveBeenCalledTimes(3);
    });

    it('deletes the native secret without treating a missing value as an error', async () => {
        expect(isKeyringAvailable()).toBe(true);
        await expect(deleteAuthBundle('missing')).resolves.toBeUndefined();
        expect(remove).toHaveBeenCalledWith({ service: 'vertesia', name: 'missing' });
    });
});
