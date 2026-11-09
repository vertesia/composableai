import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import enquirer from 'enquirer';
import open from 'open';
import { handleCors } from './cors.js';
import {
    CALLBACK_HOST,
    isPeerOwnedByCurrentUser,
    RequestBodyTooLargeError,
    readRequestBody,
    startServer,
} from './server.js';

const { prompt } = enquirer;

/** A login result is a handful of identifiers, URLs and tokens; nothing legitimate comes close to this. */
const MAX_CALLBACK_BODY_BYTES = 64 * 1024;

export interface ConfigPayload {
    profile?: string;
    account?: string;
    project?: string;
}

export interface ConfigResult extends Required<ConfigPayload> {
    studio_server_url: string;
    zeno_server_url: string;
    oauth_server_url?: string;
    token: string;
    id_token?: string;
    refresh_token?: string;
    expires_in?: number;
    access_token_expires_at?: number;
    /** Lifetime of `refresh_token` in seconds, as reported by the authorization server. */
    refresh_token_expires_in?: number;
    refresh_token_expires_at?: number;
    oauth_client_id?: string;
    oauth_resource?: string;
}

export async function startConfigSession(
    config_url: string,
    payload: ConfigPayload,
    callback: (response: ConfigResult | undefined) => void | Promise<void>,
    signal?: AbortSignal,
) {
    if (!config_url) {
        console.error(
            'You are trying to update a profile without a config_url. Your profile was likely created with a previous version of the cli.',
        );
        console.error('Please, delete the profile and create it again.');
        process.exit(1);
    }
    let server: Server | undefined;
    let completed = false;

    function closeServer() {
        if (server?.listening) {
            server.close();
        }
    }

    function cleanup() {
        closeServer();
        if (signal) {
            signal.removeEventListener('abort', onAbort);
        } else {
            process.off('SIGINT', onInterrupt);
            process.off('SIGTERM', onInterrupt);
            process.stdin.off('data', onInput);
        }
    }

    async function complete(result: ConfigResult) {
        if (completed) {
            return;
        }
        completed = true;
        cleanup();
        await callback(result);
    }

    function onAbort() {
        if (completed) {
            return;
        }
        completed = true;
        cleanup();
    }

    function onInterrupt() {
        if (!completed) {
            completed = true;
            cleanup();
        }
        console.log('\nAuthentication interrupted.');
        process.exit(130);
    }

    function onInput(chunk: Buffer | string) {
        if (String(chunk).includes('\x03')) {
            onInterrupt();
        }
    }

    if (signal?.aborted) {
        return;
    }

    if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
    } else {
        process.once('SIGINT', onInterrupt);
        process.once('SIGTERM', onInterrupt);
        process.stdin.on('data', onInput);
    }

    // The short code is only shown to the user for a visual check. The state is the capability that authorizes a
    // callback: it travels only in the redirect URI handed to the browser. That URI is an argument of the browser
    // launcher, which other local accounts can read on Linux, so a callback must also come from a socket owned by
    // this account wherever the platform can tell (see isPeerOwnedByCurrentUser).
    const code = randomInt(1000, 9999);
    const state = randomBytes(32).toString('base64url');

    try {
        // http.createServer ignores the returned promise, so the handler reports its own failures.
        const handleCallback = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
            if (handleCors(req, res)) {
                return;
            }

            if (req.method !== 'POST') {
                res.statusCode = 405;
                res.end();
                return;
            }
            const requestUrl = new URL(req.url ?? '/', `http://${CALLBACK_HOST}`);
            if (requestUrl.pathname !== '/') {
                res.statusCode = 404;
                res.end();
                return;
            }
            // Authorize before reading the body, so an unrelated peer cannot make this process buffer anything.
            if (
                !isExpectedState(requestUrl.searchParams.get('state'), state) ||
                !(await isPeerOwnedByCurrentUser(req.socket))
            ) {
                res.statusCode = 403;
                res.setHeader('Connection', 'close');
                res.end();
                return;
            }
            if (signal?.aborted || completed) {
                res.statusCode = 410;
                res.setHeader('Connection', 'close');
                res.end();
                return;
            }

            try {
                const result = readConfigResult(await readRequestBody(req, MAX_CALLBACK_BODY_BYTES));
                res.statusCode = 200;
                res.end();

                if (signal?.aborted || completed) {
                    return;
                }

                await complete(result);
            } catch (error: unknown) {
                if (error instanceof RequestBodyTooLargeError) {
                    res.statusCode = 413;
                    res.setHeader('Connection', 'close');
                    res.end();
                    return;
                }
                res.statusCode = 500;
                res.end();
                console.error('Error processing request:', error);
            }
        };
        server = await startServer((req, res) => {
            handleCallback(req, res).catch((error) => {
                console.error('Error handling callback request:', error);
            });
        });

        const address = server.address();
        if (!address || typeof address === 'string') {
            throw new Error('Unable to determine local callback port');
        }
        const port = address.port;
        const params = new URLSearchParams();
        const redirectUri = new URL(`http://${CALLBACK_HOST}:${port}/`);
        redirectUri.searchParams.set('state', state);
        params.append('redirect_uri', redirectUri.toString());
        params.append('code', String(code));
        if (payload.profile) params.append('profile', payload.profile);
        if (payload.account) params.append('account', payload.account);
        if (payload.project) params.append('project', payload.project);
        const url = `${config_url}?${params.toString()}`;

        console.log('Opening browser to', url);
        open(url).catch((error) => {
            console.error('Unable to open browser:', error instanceof Error ? error.message : String(error));
        });
        console.log(`The session code is ${code}`);

        // Handle manual token entry
        try {
            // Check if already aborted
            if (signal?.aborted || completed) {
                return;
            }

            const answer = await prompt<{ result?: string }>({
                name: 'result',
                type: 'input',
                message: 'The browser failed to send the token? Copy the token here',
            });

            // Check if aborted after prompt
            if (signal?.aborted || completed) {
                return;
            }

            const resultText = answer.result?.trim();
            if (resultText) {
                try {
                    await complete(readConfigResult(resultText));
                } catch {
                    console.error('Invalid token');
                    process.exit(1);
                }
            } else {
                // Empty answer — enquirer 2.x resolves with `result: ''` on Ctrl-C
                // rather than rejecting. Without this branch the HTTP server stays
                // open and the process hangs.
                cleanup();
                console.log('\nAuthentication cancelled.');
                process.exit(130);
            }
        } catch (err: unknown) {
            // This could be thrown if the prompt is interrupted
            cleanup();
            if (signal?.aborted) {
                return;
            }
            throw err;
        }
    } catch (err: unknown) {
        cleanup();

        // Only throw if not aborted
        if (!signal?.aborted) {
            throw err;
        }
    }
}

function isExpectedState(received: string | null, expected: string): boolean {
    if (!received) {
        return false;
    }
    const receivedBytes = Buffer.from(received);
    const expectedBytes = Buffer.from(expected);
    return receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes);
}

function readConfigResult(raw: string): ConfigResult {
    const parsed: unknown = JSON.parse(raw);
    if (!isConfigResult(parsed)) {
        throw new Error('Invalid callback payload');
    }
    return parsed;
}

function isConfigResult(value: unknown): value is ConfigResult {
    if (!value || typeof value !== 'object') {
        return false;
    }
    return (
        hasStringField(value, 'profile') &&
        hasStringField(value, 'account') &&
        hasStringField(value, 'project') &&
        hasStringField(value, 'studio_server_url') &&
        hasStringField(value, 'zeno_server_url') &&
        hasStringField(value, 'token')
    );
}

function hasStringField(value: object, key: string): boolean {
    return typeof Reflect.get(value, key) === 'string';
}

//startConfigSession("https://localhost:5173/cli", {}, (result: ConfigResult) => console.log("Logged in", result));
