import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withProfileAuthLock } from './auth-lock.js';

let directory: string;
beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'cli-auth-lock-'));
});
afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
});

describe('profile authentication lock', () => {
    it('serializes separate processes sharing the same profile', async () => {
        const counter = join(directory, 'counter');
        await writeFile(counter, '0');
        const children = [0, 1].map(() => {
            const child = spawn(
                process.execPath,
                [
                    fileURLToPath(new URL('./test/auth-lock-child.mjs', import.meta.url)),
                    new URL('./auth-lock.ts', import.meta.url).href,
                    directory,
                    counter,
                ],
                { stdio: ['ignore', 'pipe', 'pipe'] },
            );
            let stderr = '';
            child.stderr.on('data', (data) => {
                stderr += String(data);
            });
            const ready = new Promise<void>((resolve, reject) => {
                child.stdout.once('data', () => resolve());
                child.once('error', reject);
                child.once('exit', () => reject(new Error(`Child exited before ready: ${stderr}`)));
            });
            const done = new Promise<void>((resolve, reject) => {
                child.once('error', reject);
                child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(stderr))));
            });
            // Attach a handler immediately; the assertions below still observe a failure.
            void done.catch(() => {});
            return { child, ready, done };
        });
        try {
            await Promise.all(children.map(({ ready }) => ready));
            await writeFile(join(directory, 'start'), '');
            await Promise.all(children.map(({ done }) => done));
            expect(await readFile(counter, 'utf8')).toBe('2');
        } finally {
            for (const { child } of children) child.kill();
        }
    }, 10_000);

    it('releases the lock when the exchange fails', async () => {
        await expect(
            withProfileAuthLock(
                'profile',
                async () => {
                    throw new Error('Unavailable');
                },
                directory,
            ),
        ).rejects.toThrow('Unavailable');
        expect(await withProfileAuthLock('profile', async () => 'recovered', directory)).toBe('recovered');
    });

    it('recovers a stale lock left by a terminated process', async () => {
        const key = createHash('sha256').update('profile').digest('hex');
        const lockPath = join(directory, `${key}.lock`);
        await mkdir(lockPath);
        const old = new Date(Date.now() - 120_000);
        await utimes(lockPath, old, old);
        expect(await withProfileAuthLock('profile', async () => 'recovered', directory)).toBe('recovered');
    });
});
