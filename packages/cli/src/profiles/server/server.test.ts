import type { Server } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    readFile: vi.fn<(path: string, encoding: string) => Promise<string>>(),
    useRealProc: { value: true },
}));

vi.mock('node:fs/promises', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:fs/promises')>();
    return {
        ...actual,
        readFile: (path: string, encoding: BufferEncoding) =>
            mocks.useRealProc.value ? actual.readFile(path, encoding) : mocks.readFile(path, encoding),
    };
});

import { isPeerOwnedByCurrentUser, readSocketTable, socketKey, startServer } from './server.js';

const OWN_UID = 1000;
const OTHER_UID = 1001;
const SERVER = { address: '127.0.0.1', port: 43_210 };
const CLIENT = { address: '127.0.0.1', port: 51_000 };
const HEADER = '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode';

/** A `/proc/net/tcp` row on a little-endian host. */
function row(local: typeof SERVER, remote: typeof SERVER, state: string, uid: number): string {
    const address = (value: string) =>
        value
            .split('.')
            .map((byte) => Number(byte).toString(16).padStart(2, '0').toUpperCase())
            .reverse()
            .join('');
    const port = (value: number) => value.toString(16).padStart(4, '0').toUpperCase();
    return `   0: ${address(local.address)}:${port(local.port)} ${address(remote.address)}:${port(remote.port)} ${state} 00000000:00000000 00:00000000 00000000 ${uid} 0 12345 1`;
}

const acceptedSocket = row(SERVER, CLIENT, '01', OWN_UID);

function fakeSocket(): Socket {
    return {
        localAddress: SERVER.address,
        localPort: SERVER.port,
        remoteAddress: CLIENT.address,
        remotePort: CLIENT.port,
    } as Socket;
}

describe('readSocketTable', () => {
    it('decodes IPv4 and IPv4-mapped IPv6 rows with their owner and state', () => {
        const tcp6 =
            '   1: 0000000000000000FFFF00000100007F:1F90 0000000000000000FFFF00000100007F:0050 01 00000000:00000000 00:00000000 00000000  1001        0 1 1';
        const sockets = readSocketTable([HEADER, acceptedSocket, row(CLIENT, SERVER, '06', 0), tcp6].join('\n'), true);

        expect(sockets.get(socketKey('127.0.0.1:43210', '127.0.0.1:51000'))).toEqual({
            uid: OWN_UID,
            established: true,
        });
        expect(sockets.get(socketKey('127.0.0.1:51000', '127.0.0.1:43210'))).toEqual({ uid: 0, established: false });
        expect(sockets.get(socketKey('127.0.0.1:8080', '127.0.0.1:80'))).toEqual({ uid: OTHER_UID, established: true });
        expect(sockets.size).toBe(3);
    });

    it('decodes addresses printed by a big-endian host', () => {
        const sockets = readSocketTable(
            '   0: 7F000001:A8CA 7F000001:C738 01 00000000:00000000 00:00000000 00000000 7 0 1 1',
            false,
        );
        expect(sockets.get(socketKey('127.0.0.1:43210', '127.0.0.1:51000'))).toEqual({ uid: 7, established: true });
    });
});

describe('isPeerOwnedByCurrentUser on Linux', () => {
    const platform = process.platform;

    beforeEach(() => {
        mocks.useRealProc.value = false;
        Object.defineProperty(process, 'platform', { value: 'linux' });
        vi.spyOn(process, 'getuid').mockReturnValue(OWN_UID);
    });

    afterEach(() => {
        mocks.useRealProc.value = true;
        Object.defineProperty(process, 'platform', { value: platform });
        vi.restoreAllMocks();
    });

    function withTable(...rows: string[]) {
        mocks.readFile.mockImplementation(async (path: string) => {
            if (path === '/proc/net/tcp') {
                return [HEADER, ...rows].join('\n');
            }
            throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        });
    }

    it('accepts a connection opened by this account', async () => {
        withTable(acceptedSocket, row(CLIENT, SERVER, '01', OWN_UID));
        await expect(isPeerOwnedByCurrentUser(fakeSocket())).resolves.toBe(true);
    });

    it('accepts a connection opened by root (a localhost relay)', async () => {
        withTable(acceptedSocket, row(CLIENT, SERVER, '01', 0));
        await expect(isPeerOwnedByCurrentUser(fakeSocket())).resolves.toBe(true);
    });

    it('refuses a connection opened by another account', async () => {
        withTable(acceptedSocket, row(CLIENT, SERVER, '01', OTHER_UID));
        await expect(isPeerOwnedByCurrentUser(fakeSocket())).resolves.toBe(false);
    });

    it('refuses a client that closed its end, which the kernel lists as owned by root', async () => {
        // FIN_WAIT2 and TIME_WAIT entries carry uid 0 whoever opened them.
        withTable(acceptedSocket, row(CLIENT, SERVER, '05', 0));
        await expect(isPeerOwnedByCurrentUser(fakeSocket())).resolves.toBe(false);
        withTable(acceptedSocket, row(CLIENT, SERVER, '06', 0));
        await expect(isPeerOwnedByCurrentUser(fakeSocket())).resolves.toBe(false);
    });

    it('refuses a client socket the table does not list', async () => {
        withTable(acceptedSocket);
        await expect(isPeerOwnedByCurrentUser(fakeSocket())).resolves.toBe(false);
    });

    it('does not judge a connection when the table does not even list the accepted socket', async () => {
        withTable();
        await expect(isPeerOwnedByCurrentUser(fakeSocket())).resolves.toBe(true);
    });
});

describe.runIf(process.platform === 'linux')('isPeerOwnedByCurrentUser against the kernel', () => {
    let server: Server | undefined;

    afterEach(() => {
        server?.close();
        server = undefined;
    });

    it('recognises a loopback connection made by this process', async () => {
        const verdict = new Promise<boolean>((resolve, reject) => {
            void startServer((req, res) => {
                isPeerOwnedByCurrentUser(req.socket).then(resolve, reject);
                res.end();
            }).then((started) => {
                server = started;
                const { port } = started.address() as AddressInfo;
                return fetch(`http://127.0.0.1:${port}/`, { method: 'POST' });
            }, reject);
        });

        await expect(verdict).resolves.toBe(true);
    });
});
