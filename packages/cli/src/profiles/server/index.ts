import { randomInt } from "crypto";
import enquirer from "enquirer";
import { Server } from "http";
import net from "net";
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
}


export async function startConfigSession(
    config_url: string, 
    payload: ConfigPayload, 
    callback: (response: ConfigResult | undefined) => void,
    signal?: AbortSignal
) {
    if (!config_url) {
        console.error("You are trying to update a profile without a config_url. Your profile was likely created with a previous version of the cli.");
        console.error("Please, delete the profile and create it again.");
        process.exit(1);
    }
    
    // Check if already aborted
    if (signal?.aborted) {
        callback(undefined);
        return;
    }
    
    // Handle abort signal
    const onAbort = () => {
        // Clean up and exit
        if (server) {
            server.close();
        }
        callback(undefined);
    };
    
    if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
    }
    
    const code = randomInt(1000, 9999);
    let server: Server;
    
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
                const result = JSON.parse(data as string);
                res.statusCode = 200;
                res.end();

                // Check if signal is aborted before proceeding
                if (signal?.aborted) {
                    return;
                }
                
                await callback(result);
                
                // Clean up signal listener
                if (signal) {
                    signal.removeEventListener('abort', onAbort);
                }
                
                server.close(); // close the server
            } catch (error) {
                res.statusCode = 500;
                res.end();
                console.error("Error processing request:", error);
            }
        });
        
        const port = (server.address() as net.AddressInfo).port;
        const params = new URLSearchParams();
        params.append('redirect_uri', `http://localhost:${port}`);
        params.append('code', String(code));
        if (payload.profile) params.append('profile', payload.profile);
        if (payload.account) params.append('account', payload.account);
        if (payload.project) params.append('project', payload.project);
        const url = `${config_url}?${params.toString()}`;
        
        console.log("Opening browser to", url);
        open(url);
        console.log(`The session code is ${code}`);
        
        // Handle manual token entry
        try {
            // Check if already aborted
            if (signal?.aborted) {
                return;
            }
            
            const answer: any = await prompt({
                name: 'result',
                type: 'input',
                message: "The browser failed to send the token? Copy the token here",
            });
            
            // Check if aborted after prompt
            if (signal?.aborted) {
                return;
            }
            
            const resultText = answer.result?.trim();
            if (resultText) {
                try {
                    const result = JSON.parse(answer.result.trim());
                    
                    // Clean up signal listener before callback
                    if (signal) {
                        signal.removeEventListener('abort', onAbort);
                    }
                    
                    await callback(result);
                    console.log('Authentication completed.');
                } catch (e) {
                    console.error("Invalid token");
                    process.exit(1);
                }
            }
        } catch (err: any) {
            // This could be thrown if the prompt is interrupted
            if (signal?.aborted) {
                return;
            }
            throw err;
        }
    } catch (err: any) {
        // Clean up signal listener on error
        if (signal) {
            signal.removeEventListener('abort', onAbort);
        }
        
        // Only throw if not aborted
        if (!signal?.aborted) {
            throw err;
        }
    }
}

//startConfigSession("https://localhost:5173/cli", {}, (result: ConfigResult) => console.log("Logged in", result));
