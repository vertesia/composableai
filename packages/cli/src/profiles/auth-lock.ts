import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:net';
import { userInfo } from 'node:os';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';

export class AuthRefreshLockError extends Error {
    constructor(message: string, cause: unknown) {
        super(message, { cause });
        this.name = 'AuthRefreshLockError';
    }
}

export class AuthRefreshBusyError extends AuthRefreshLockError {
    constructor(profileName: string, port: number, cause: unknown) {
        super(
            `Authentication refresh for profile "${profileName}" could not acquire local port 127.0.0.1:${port}. ` +
                'Another command or application may be using it. Retry later or check which process occupies the port.',
            cause,
        );
        this.name = 'AuthRefreshBusyError';
    }
}

/**
 * An exclusive loopback bind is owned by the OS until close/process exit, even
 * while a synchronous keychain prompt blocks JS. Never steal from a live owner.
 * Hash collisions (or unrelated port users) only cause contention, never bypass
 * the lock. No credentials are transmitted, and no filesystem cleanup is needed.
 */
export async function withProfileAuthLock<T>(
    profileName: string,
    operation: () => Promise<T>,
    namespace?: string,
    timeoutMs = 75_000,
): Promise<T> {
    let userNamespace: string;
    try {
        userNamespace = namespace ?? authUserNamespace();
    } catch (error: unknown) {
        throw new AuthRefreshLockError('Unable to identify the OS user for authentication coordination.', error);
    }
    const key = createHash('sha256')
        .update(JSON.stringify(['vertesia-auth-v1', userNamespace, profileName]))
        .digest();
    const port = 49_152 + (key.readUInt32BE(0) % 16_384);
    const started = performance.now();
    let notified = false;
    let server: Server;
    while (true) {
        try {
            server = await acquire(port);
            break;
        } catch (error: unknown) {
            if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EADDRINUSE') {
                throw new AuthRefreshLockError(
                    `Unable to coordinate authentication refresh for profile "${profileName}". ` +
                        `Allow this command to bind to 127.0.0.1:${port} and retry.`,
                    error,
                );
            }
            const elapsed = performance.now() - started;
            if (elapsed >= timeoutMs) throw new AuthRefreshBusyError(profileName, port, error);
            if (!notified && elapsed >= 5_000) {
                console.warn(
                    `Waiting for authentication coordination for profile "${profileName}": ` +
                        `local port 127.0.0.1:${port} is occupied...`,
                );
                notified = true;
            }
            await delay(Math.min(250, timeoutMs - elapsed));
        }
    }
    try {
        return await operation();
    } finally {
        // Cleanup must never replace a refresh failure or a persisted success.
        try {
            await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
        } catch (error: unknown) {
            server.unref();
            console.warn('Unable to release authentication coordination socket:', error);
        }
    }
}

function acquire(port: number): Promise<Server> {
    return new Promise((resolve, reject) => {
        const server = createServer((socket) => socket.destroy());
        server.once('error', reject);
        server.listen({ host: '127.0.0.1', port, exclusive: true }, () => resolve(server));
    });
}

function authUserNamespace(): string {
    // Match the OS user that owns the keychain, regardless of HOME overrides.
    // Windows reports uid -1; its OS-provided username is stable across shells.
    const user = userInfo();
    return user.uid >= 0 ? `uid:${user.uid}` : `username:${user.username}`;
}
