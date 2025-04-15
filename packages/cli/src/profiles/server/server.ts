import { Server, createServer, ServerResponse, IncomingMessage } from 'http';

export async function startServer(cb: (req: IncomingMessage, res: ServerResponse) => void): Promise<Server> {
    const server = createServer(cb);
    const onSigint = () => {
        server.close();
    }
    server.on('close', () => {
        process.off('SIGINT', onSigint);
    });
    process.on('SIGINT', onSigint);

    // start the server on a random unused port
    return new Promise((resolve, reject) => {
        server.listen().once('listening', () => resolve(server))
            .once('error', reject);
    });
}


export function readRequestBody(request: IncomingMessage) {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let body;
        request.on('data', (chunk) => {
            chunks.push(chunk);
        }).on('end', () => {
            body = Buffer.concat(chunks).toString();
            resolve(body)
        }).on('error', (err) => {
            reject(err);
        });;
    });

}