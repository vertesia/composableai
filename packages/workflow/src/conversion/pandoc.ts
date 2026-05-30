import { log } from '@temporalio/activity';
import { spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';

export function markdownWithPandoc(buffer: Buffer, fromFormat: string): Promise<string> {
    const fromType = undefined;

    return new Promise((resolve, reject) => {
        log.info(`Converting ${fromType} to markdown`);
        const input = new PassThrough();
        input.end(buffer);

        const result: string[] = [];

        const command = spawn('pandoc', ['-t', 'markdown', '-f', fromFormat], {
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
