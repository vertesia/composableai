import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

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
