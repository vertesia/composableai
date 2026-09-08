import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript-legacy';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthRefreshBusyError, withProfileAuthLock } from './auth-lock.js';

let directory: string;
beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'cli-auth-lock-'));
    const source = await readFile(new URL('./auth-lock.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    await writeFile(join(directory, 'auth-lock.mjs'), compiled.outputText);
});
afterEach(async () => {
    vi.restoreAllMocks();
    await rm(directory, { recursive: true, force: true });
});

describe('profile authentication lock', () => {
    it('serializes separate processes sharing the same profile', async () => {
        const modulePath = join(directory, 'auth-lock.mjs');
        const counter = join(directory, 'counter');
        await writeFile(counter, '0');
        const children = [0, 1].map(() => {
            const child = spawn(
                process.execPath,
                [
                    fileURLToPath(new URL('./test/auth-lock-child.mjs', import.meta.url)),
                    pathToFileURL(modulePath).href,
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

    it('cannot steal a blocked live owner, but can acquire immediately after SIGKILL', async () => {
        const child = spawn(
            process.execPath,
            [
                fileURLToPath(new URL('./test/auth-lock-child.mjs', import.meta.url)),
                pathToFileURL(join(directory, 'auth-lock.mjs')).href,
                directory,
                'unused',
                'hold',
            ],
            { stdio: ['ignore', 'pipe', 'pipe'] },
        );
        const exited = once(child, 'exit');
        try {
            await once(child.stdout, 'data');
            const acquired = once(child.stdout, 'data');
            await writeFile(join(directory, 'start'), '');
            // "acquired" is emitted just before synchronously blocking the event loop.
            await acquired;
            const operation = vi.fn(async () => 'should not run');
            await expect(withProfileAuthLock('shared-profile', operation, directory, 100)).rejects.toBeInstanceOf(
                AuthRefreshBusyError,
            );
            expect(operation).not.toHaveBeenCalled();
            child.kill('SIGKILL');
            await exited;
            expect(await withProfileAuthLock('shared-profile', async () => 'recovered', directory, 1000)).toBe(
                'recovered',
            );
        } finally {
            child.kill('SIGKILL');
            await exited;
        }
    }, 10_000);

    it.each([false, true])('does not replace the operation outcome when socket cleanup fails (%s)', async (fails) => {
        const close = Server.prototype.close;
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(Server.prototype, 'close').mockImplementationOnce(function (this: Server, callback) {
            return close.call(this, () => callback?.(new Error('cleanup failure')));
        });
        const error = new Error('original refresh error');
        const operation = withProfileAuthLock(
            'profile',
            async () => {
                if (fails) throw error;
                return 'persisted';
            },
            directory,
        );
        if (fails) await expect(operation).rejects.toBe(error);
        else await expect(operation).resolves.toBe('persisted');
    });
});
