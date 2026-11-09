import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { endianness } from 'node:os';

/** The only interface the login callback listens on. The browser is redirected to this exact address. */
export const CALLBACK_HOST = '127.0.0.1';

export async function startServer(cb: (req: IncomingMessage, res: ServerResponse) => void): Promise<Server> {
    const server = createServer(cb);

    // Start the server on a random unused loopback port: never on every interface.
    return new Promise((resolve, reject) => {
        server
            .listen(0, CALLBACK_HOST)
            .once('listening', () => resolve(server))
            .once('error', reject);
    });
}

export class RequestBodyTooLargeError extends Error {
    constructor(maxBytes: number) {
        super(`Request body exceeds ${maxBytes} bytes`);
        this.name = 'RequestBodyTooLargeError';
    }
}

/**
 * Reads a request body of at most `maxBytes` bytes. A larger body is rejected as soon as its declared length or
 * the bytes received so far exceed the budget, and nothing past the budget is kept.
 */
export function readRequestBody(request: IncomingMessage, maxBytes: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const declaredLength = Number(request.headers['content-length']);
        if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
            reject(new RequestBodyTooLargeError(maxBytes));
            return;
        }
        const chunks: Buffer[] = [];
        let received = 0;
        let rejected = false;
        request
            .on('data', (chunk: Buffer) => {
                if (rejected) {
                    return;
                }
                received += chunk.length;
                if (received > maxBytes) {
                    rejected = true;
                    chunks.length = 0;
                    reject(new RequestBodyTooLargeError(maxBytes));
                    return;
                }
                chunks.push(chunk);
            })
            .on('end', () => {
                if (!rejected) {
                    resolve(Buffer.concat(chunks).toString());
                }
            })
            .on('error', (err) => {
                reject(err);
            });
    });
}

/** The kernel socket tables that name the account owning each TCP socket in this network namespace. */
const LINUX_SOCKET_TABLES = ['/proc/net/tcp', '/proc/net/tcp6'];

/** `st` column value of an established connection in `/proc/net/tcp`. */
const TCP_ESTABLISHED = '01';

export interface SocketTableEntry {
    uid: number;
    established: boolean;
}

/**
 * Tells whether the client end of an accepted loopback connection belongs to this account (or to root, which can
 * read everything this process holds anyway).
 *
 * The browser launcher is started with the redirect URI as an argument, so on Linux any local account can read its
 * secret from `/proc/<pid>/cmdline`. The kernel socket table names the owner of every socket, which lets a callback
 * be refused when another account opened the connection, whatever it knows.
 *
 * Returns true where no socket table is available to check (macOS, Windows, or a Linux layer whose table does not
 * list this process's own sockets); the caller then relies on the secret alone.
 */
export async function isPeerOwnedByCurrentUser(socket: Socket): Promise<boolean> {
    if (process.platform !== 'linux' || typeof process.getuid !== 'function') {
        return true;
    }
    const { localAddress, localPort, remoteAddress, remotePort } = socket;
    if (!localAddress || !localPort || !remoteAddress || !remotePort) {
        return false;
    }
    const tables = await Promise.all(
        LINUX_SOCKET_TABLES.map((path) => readFile(path, 'utf8').catch((_error: unknown) => '')),
    );
    const sockets = readSocketTable(tables.join('\n'), endianness() === 'LE');
    const server = endpoint(localAddress, localPort);
    const client = endpoint(remoteAddress, remotePort);
    if (!sockets.has(socketKey(server, client))) {
        // The table does not show the accepted socket itself, so it says nothing about this connection.
        return true;
    }
    const peer = sockets.get(socketKey(client, server));
    // A client socket missing from this namespace's table cannot be attributed: refuse it. Only an established
    // socket counts: the kernel reports uid 0 for a closing or timewait one, which any account can produce by
    // closing its end right after sending the request.
    return peer?.established === true && (peer.uid === process.getuid() || peer.uid === 0);
}

/** Reads `/proc/net/tcp{,6}` content into a map from `local>remote` endpoints to the socket's owner and state. */
export function readSocketTable(table: string, littleEndian: boolean): Map<string, SocketTableEntry> {
    const sockets = new Map<string, SocketTableEntry>();
    for (const line of table.split('\n')) {
        // sl local_address rem_address st tx_queue:rx_queue tr:tm->when retrnsmt uid ...
        const fields = line.trim().split(/\s+/);
        if (fields.length < 8 || !/^\d+:$/.test(fields[0])) {
            continue;
        }
        const local = readTableEndpoint(fields[1], littleEndian);
        const remote = readTableEndpoint(fields[2], littleEndian);
        const uid = Number(fields[7]);
        if (!local || !remote || !Number.isInteger(uid)) {
            continue;
        }
        const key = socketKey(local, remote);
        // A reused 4-tuple can still have its old timewait entry listed: the established one is the live socket.
        if (!sockets.get(key)?.established) {
            sockets.set(key, { uid, established: fields[3] === TCP_ESTABLISHED });
        }
    }
    return sockets;
}

export function socketKey(local: string, remote: string): string {
    return `${local}>${remote}`;
}

function endpoint(address: string, port: number): string {
    return `${address.replace(/^::ffff:/i, '')}:${port}`;
}

/** Decodes `0100007F:1F90` (IPv4) or a 32-digit IPv4-mapped IPv6 address. Other IPv6 addresses are not needed. */
function readTableEndpoint(value: string, littleEndian: boolean): string | undefined {
    const match = /^([0-9A-F]{8}|[0-9A-F]{32}):([0-9A-F]{4})$/i.exec(value);
    if (!match) {
        return undefined;
    }
    // The address is printed as 32-bit words in host byte order, the port as a plain number.
    const words = match[1].match(/.{8}/g) ?? [];
    const bytes = words.flatMap((word) => {
        const wordBytes = [...Buffer.from(word, 'hex')];
        return littleEndian ? wordBytes.reverse() : wordBytes;
    });
    const port = Number.parseInt(match[2], 16);
    if (bytes.length === 4) {
        return endpoint(bytes.join('.'), port);
    }
    const isIpv4Mapped = bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
    return isIpv4Mapped ? endpoint(bytes.slice(12).join('.'), port) : undefined;
}
