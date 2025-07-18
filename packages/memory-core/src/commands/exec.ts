import { ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import { Stream, Writable } from 'stream';
import { Command, splitPipeCommands } from '../utils/cmdline.js';
import { BufferWritableStream } from '../utils/stream.js';

export interface ExecOptions {
    quiet?: boolean;
}

export async function exec(commandLine: string, options: ExecOptions = {}): Promise<string | undefined> {
    const verbose = !options.quiet;
    commandLine = commandLine.trim();
    const { commands, out } = splitPipeCommands(commandLine);
    if (!commands.length) {
        throw new Error('Invalid command line. No command: ' + commandLine);
    }

    let outStream: Writable;
    if (out) {
        outStream = fs.createWriteStream(out, { flags: 'w' });
    } else {
        outStream = new BufferWritableStream();
    }
    const pipePromise = executePipe(commands, outStream, verbose);
    const outPromise = new Promise((resolve, reject) => {
        outStream.on('finish', () => {
            resolve(undefined);
        });
        outStream.on('error', (err: Error) => {
            reject(err);
            outStream.destroy();
        });
    });

    const [status] = await Promise.all([pipePromise, outPromise]);

    if (verbose) {
        if (!status) {
            console.log(`Command: ${commandLine} exited with status ${status}`);
        } else {
            console.error(`Command: ${commandLine} exited with status ${status}`);
        }
    }

    if (outStream instanceof BufferWritableStream) {
        return outStream.getText();
    } else {
        return undefined;
    }
}


export function executePipe(commands: Command[], finalOutput: Writable | undefined, verbose: boolean = false) {
    return new Promise((resolve, reject) => {
        let input: Stream | undefined;
        let child: ChildProcess | undefined;
        for (const cmd of commands) {
            verbose && console.log(`Running: ${cmd.name} ${cmd.args?.join(' ')}`);
            child = spawn(cmd.name, cmd.args, {
                // in, out, err
                stdio: ['pipe', 'pipe', 'inherit'],
            });
            if (input) {
                input.pipe(child.stdin!);
            }
            input = child.stdout!;
            child.on("error", (err: Error) => {
                console.error(`Failed to run ${cmd.name}`, err);
                reject(err);
            })
        }
        if (child) {
            child.on("exit", (code: number | null, signal: string | null) => {
                resolve(code !== null ? code : signal);
            });
            finalOutput && child.stdout?.pipe(finalOutput);
        } else {
            reject(new Error("no child spawned"));
        }
    });

}
