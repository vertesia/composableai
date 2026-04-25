import { randomInt } from "crypto";
import enquirer from "enquirer";
import { Server } from "http";
import open from "open";
import { handleCors } from "./cors.js";
import { readRequestBody, startServer } from "./server.js";

const { prompt } = enquirer;

export interface ConfigPayload {
    profile?: string;
    account?: string;
    project?: string;
}

export interface ConfigResult extends Required<ConfigPayload> {
    studio_server_url: string;
    zeno_server_url: string;
    token: string;
    id_token?: string;
    refresh_token?: string;
    expires_in?: number;
    access_token_expires_at?: number;
    refresh_token_expires_at?: number;
    oauth_client_id?: string;
    oauth_resource?: string;
}


export async function startConfigSession(
    config_url: string,
    payload: ConfigPayload,
    callback: (response: ConfigResult | undefined) => void | Promise<void>,
    signal?: AbortSignal
) {
    if (!config_url) {
        console.error("You are trying to update a profile without a config_url. Your profile was likely created with a previous version of the cli.");
        console.error("Please, delete the profile and create it again.");
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
        console.log("\nAuthentication interrupted.");
        process.exit(130);
    }

    if (signal?.aborted) {
        return;
    }

    if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
    } else {
        process.once('SIGINT', onInterrupt);
        process.once('SIGTERM', onInterrupt);
    }

    const code = randomInt(1000, 9999);

    try {
        server = await startServer(async (req, res) => {
            if (handleCors(req, res)) {
                return;
            }

            if (req.method !== 'POST') {
                res.statusCode = 405;
                res.end();
                return;
            }
            if (req.url !== '/') {
                res.statusCode = 404;
                res.end();
                return;
            }

            try {
                const data = await readRequestBody(req);
                if (typeof data !== 'string') {
                    throw new Error('Invalid callback payload');
                }
                const result = readConfigResult(data);
                res.statusCode = 200;
                res.end();

                if (signal?.aborted || completed) {
                    return;
                }

                await complete(result);
            } catch (error) {
                res.statusCode = 500;
                res.end();
                console.error("Error processing request:", error);
            }
        });

        const address = server.address();
        if (!address || typeof address === 'string') {
            throw new Error('Unable to determine local callback port');
        }
        const port = address.port;
        const params = new URLSearchParams();
        params.append('redirect_uri', `http://localhost:${port}`);
        params.append('code', String(code));
        if (payload.profile) params.append('profile', payload.profile);
        if (payload.account) params.append('account', payload.account);
        if (payload.project) params.append('project', payload.project);
        const url = `${config_url}?${params.toString()}`;

        console.log("Opening browser to", url);
        open(url).catch(error => {
            console.error("Unable to open browser:", error instanceof Error ? error.message : String(error));
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
                message: "The browser failed to send the token? Copy the token here",
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
                    console.error("Invalid token");
                    process.exit(1);
                }
            }
        } catch (err: unknown) {
            // This could be thrown if the prompt is interrupted
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
    return hasStringField(value, 'profile')
        && hasStringField(value, 'account')
        && hasStringField(value, 'project')
        && hasStringField(value, 'studio_server_url')
        && hasStringField(value, 'zeno_server_url')
        && hasStringField(value, 'token');
}

function hasStringField(value: object, key: string): boolean {
    return typeof Reflect.get(value, key) === 'string';
}

//startConfigSession("https://localhost:5173/cli", {}, (result: ConfigResult) => console.log("Logged in", result));
