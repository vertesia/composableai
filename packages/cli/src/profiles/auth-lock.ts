import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import lockfile from 'proper-lockfile';

/** Coordinate every CLI process using the same keychain profile, across checkouts and runtimes. */
export async function withProfileAuthLock<T>(
    profileName: string,
    operation: () => Promise<T>,
    directory = join(homedir(), '.vertesia', 'auth-locks'),
): Promise<T> {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    // Neither credentials nor profile names are written to disk.
    const key = createHash('sha256').update(profileName).digest('hex');
    const release = await lockfile.lock(join(directory, key), {
        realpath: false,
        stale: 60_000,
        update: 10_000,
        retries: { retries: 300, factor: 1, minTimeout: 250, maxTimeout: 250 },
    });
    try {
        return await operation();
    } finally {
        await release();
    }
}
