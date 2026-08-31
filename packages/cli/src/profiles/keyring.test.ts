import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteAuthBundle, isKeyringAvailable, readAuthBundle, writeAuthBundle } from './keyring.js';

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

    it('deletes the native secret without treating a missing value as an error', async () => {
        expect(isKeyringAvailable()).toBe(true);
        await expect(deleteAuthBundle('missing')).resolves.toBeUndefined();
        expect(remove).toHaveBeenCalledWith({ service: 'vertesia', name: 'missing' });
    });
});
