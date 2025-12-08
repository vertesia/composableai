import { ExecutionRun } from "@vertesia/common";
import { Command } from "commander";
import { getClient } from "../client.js";
import { Spinner } from "../utils/console.js";
import { readFile, readStdin, writeFile } from "../utils/stdio.js";
import { ExecutionQueue, ExecutionRequest } from "./executor.js";


export default async function runInteraction(program: Command, interactionSpec: string, options: Record<string, any>) {
    // Create abort controller for handling interruption
    const abortController = new AbortController();
    const { signal } = abortController;
    
    // Set up signal handlers
    let spinner: Spinner | undefined;
    
    const cleanup = () => {
        if (spinner) {
            spinner.done(false);
        }
        console.log("\nInteraction execution interrupted");
        process.exit(0);
    };
    
    const handleSignal = () => {
        abortController.abort();
        cleanup();
    };
    
    process.on('SIGINT', handleSignal);
    process.on('SIGTERM', handleSignal);
    
    try {
        const queue = new ExecutionQueue();
        const data = await getInputData(options);
        const client = await getClient(program);

        let count = options.count ? parseInt(options.count) : 1;
        if (isNaN(count) || count < 0) {
            count = 1;
        }

        const hasMultiOutputs = (Array.isArray(data) && data.length > 1) || count > 1;
        const totalSize = Array.isArray(data) ? data.length * count : count;

        let onChunk: ((chunk: any) => void) | undefined = undefined;
        // TODO we can add an option --async to be able to force sync mode and use streaming for array data inputs?
        if (!hasMultiOutputs && options.stream) { // stream to stdout
            onChunk = (chunk: string) => {
                if (chunk && !signal.aborted) {
                    process.stdout.write(chunk);
                }
            }
        }

        let verbose = options.verbose || false;

        if (!onChunk) {
            if (!verbose) {
                spinner = new Spinner('dots');
                spinner.prefix = `Running. Please be patient (0/${totalSize}) `;
                spinner.start();
            } else {
                console.log(`Running ${totalSize} requests. Please be patient`)
            }
        } else {
            verbose = false;
        }

        // Check if aborted early
        if (signal.aborted) {
            if (spinner) spinner.done(false);
            return;
        }

        let result: ExecutionRun[]
        
        for (let i = 0; i < count; i++) {
            // Exit loop if aborted
            if (signal.aborted) break;
            
            let runNumber = count > 1 ? 0 : i + 1;
            if (Array.isArray(data)) {
                for (const d of data) {
                    // Exit loop if aborted
                    if (signal.aborted) break;
                    
                    const req = new ExecutionRequest(client, interactionSpec, d, options);
                    if (runNumber > 0) {
                        req.runNumber = runNumber;
                    }
                    queue.add(req);
                }
            } else {
                const req = new ExecutionRequest(client, interactionSpec, data, options);
                if (runNumber > 0) {
                    req.runNumber = runNumber;
                }
                queue.add(req);
            }
        }

        // Check if aborted again
        if (signal.aborted) {
            if (spinner) spinner.done(false);
            return;
        }

        result = await queue.run((completed) => {
            // Skip updating if aborted
            if (signal.aborted) return;
            
            if (spinner) {
                spinner.prefix = `Running. Please be patient (${completed.length}/${totalSize}) `;
            } else if (verbose) {
                for (const c of completed) {
                    console.log(`Run completed run. Environment: ${c.environment.name}; Model: , ${c.modelId}`);
                    console.log('Input data: ', c.parameters);
                    console.log('----------------------------------------');
                    console.log('Output data: ', c.result);
                    console.log('----------------------------------------\n');
                }
            }
        }, onChunk, signal);
        
        // Check if aborted before wrapping up
        if (signal.aborted) return;
        
        if (spinner) spinner.done(true);
        
        // Clean up signal handlers
        process.off('SIGINT', handleSignal);
        process.off('SIGTERM', handleSignal);
        
        writeResult(result, hasMultiOutputs, options);
    } catch (err: any) {
        // Clean up signal handlers
        process.off('SIGINT', handleSignal);
        process.off('SIGTERM', handleSignal);
        
        // Don't show error if aborted
        if (signal.aborted) {
            return;
        }
        
        if (spinner) spinner.done(false);
        console.error("Failed to execute the interaction", err?.message);
        throw err;
    }
}

async function getInputData(options: Record<string, any>) {
    try {
        let input: any;
        if (options.data) {
            input = options.data;
        } else if (options.input) {
            if (options.input === true) {
                input = await readStdin();
            } else {
                input = readFile(options.input);
            }
        }
        return input ? JSON.parse(input) : undefined;
    } catch (err: any) {
        console.error('Invalid JSON data: ', err.message);
        process.exit(1);
    }
}

function writeResult(runs: ExecutionRun[], hasMultiOutputs: boolean, options: Record<string, any>) {
    const out = formatResult(runs, hasMultiOutputs, options);
    if (typeof options.output === 'string') {
        writeFile(options.output, out);
    } else if (!options.stream || hasMultiOutputs) {
        console.log(out);
    }
}

function formatResult(runs: ExecutionRun[], hasMultiOutputs: boolean, options: Record<string, any>) {
    const outputData = options.dataOnly ? runs.map(run => run.result) : runs;
    let out: string;
    if (!hasMultiOutputs) {
        out = toJson(outputData[0], 4);
    } else if (options.jsonl) {
        const lines = [];
        for (const data of outputData) {
            lines.push(toJson(data));
        }
        out = lines.join('\n');
    } else {
        out = toJson(outputData, 4);
    }
    return out;
}

function toJson(data: any, space?: string | number | undefined) {
    if (typeof data === 'string') {
        return data;
    } else {
        return JSON.stringify(data, undefined, space);
    }
}