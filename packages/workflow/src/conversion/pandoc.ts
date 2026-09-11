import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { log } from '@temporalio/activity';
import pLimit from 'p-limit';
import { compactHtmlBeforePandoc } from './compact-html.js';

const pandocLimit = pLimit(1);

function getCompactHtmlFilterPath(): string {
    const colocatedPath = fileURLToPath(new URL('./compact-html.lua', import.meta.url));
    if (existsSync(colocatedPath)) {
        return colocatedPath;
    }

    // Activity bundles inline this module, so resolve the installed package before locating its adjacent asset.
    const packageEntryPath = createRequire(import.meta.url).resolve('@vertesia/workflow');
    const installedPath = join(dirname(packageEntryPath), 'conversion', 'compact-html.lua');
    if (existsSync(installedPath)) {
        return installedPath;
    }

    throw new Error('Pandoc HTML compaction filter is missing from the runtime package');
}

export function markdownWithPandoc(buffer: Buffer, fromFormat: string, signal?: AbortSignal): Promise<string> {
    return pandocLimit(async () => {
        signal?.throwIfAborted();
        return spawnPandoc(buffer, fromFormat, signal);
    });
}

function spawnPandoc(buffer: Buffer, fromFormat: string, signal?: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
        log.debug(`Converting ${fromFormat} to markdown`);
        const input = new PassThrough();
        input.end(fromFormat === 'html' ? compactHtmlBeforePandoc(buffer) : buffer);

        const result: string[] = [];

        const args = ['-t', 'markdown', '-f', fromFormat];
        if (fromFormat === 'html') {
            args.push(`--lua-filter=${getCompactHtmlFilterPath()}`);
        }
        const command = spawn('pandoc', args, {
            stdio: 'pipe',
            signal,
        });
        input.pipe(command.stdin);

        let commandError: Error | undefined;

        command.stdout.setEncoding('utf8');
        command.stdout.on('data', (data: string) => {
            result.push(data);
        });
        // Pandoc can emit many warnings. Always consume stderr so its bounded OS pipe
        // cannot stall the conversion while stdout is being collected.
        command.stderr.resume();
        command.on('close', (code, childSignal) => {
            if (signal?.aborted) {
                reject(signal.reason);
            } else if (commandError) {
                reject(commandError);
            } else if (code) {
                reject(new Error(`pandoc exited with code ${code}`));
            } else if (childSignal) {
                reject(new Error(`pandoc exited due to signal ${childSignal}`));
            } else {
                resolve(result.join(''));
            }
        });

        command.on('error', (err) => {
            // Wait for `close` before settling so the limiter never starts another
            // memory-heavy conversion while this child's stdio is still closing.
            commandError = err;
        });
        command.stdin.on('error', (err) => {
            commandError ??= err;
        });
    });
}
