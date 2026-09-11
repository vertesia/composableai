import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { log } from '@temporalio/activity';

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

export function markdownWithPandoc(buffer: Buffer, fromFormat: string): Promise<string> {
    const fromType = undefined;

    return new Promise((resolve, reject) => {
        log.info(`Converting ${fromType} to markdown`);
        const input = new PassThrough();
        input.end(buffer);

        const result: string[] = [];

        const args = ['-t', 'markdown', '-f', fromFormat];
        if (fromFormat === 'html') {
            args.push(`--lua-filter=${getCompactHtmlFilterPath()}`);
        }
        const command = spawn('pandoc', args, {
            stdio: 'pipe',
        });
        input.pipe(command.stdin);

        command.stdout.on('data', (data: string) => {
            result.push(data.toString());
        });
        command.on('exit', (code) => {
            if (code) {
                reject(new Error(`pandoc exited with code ${code}`));
            }
        });
        command.on('close', (code) => {
            if (code) {
                reject(new Error(`pandoc exited with code ${code}`));
            } else {
                resolve(result.join(''));
            }
        });

        command.on('error', (err) => {
            reject(err);
        });
    });
}
