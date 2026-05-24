import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { readFile } from "node:fs/promises";
import tmp from 'tmp';
tmp.setGracefulCleanup();

export function pdfFileToText(input: string, output: string) {
    return new Promise((resolve, reject) => {

        const command = spawn("mutool", ["convert", "-o", output, input]);

        command.on('exit', (code) => {
            if (code) {
                reject(new Error(`mutool exited with code ${code}`));
            }
        });

        command.on('close', (code) => {
            if (code) {
                reject(new Error(`mutool exited with code ${code}`));
            } else {
                return resolve(output);
            };
        });

        command.on('error', (err) => {
            reject(err);
        });

    });

}
export function pdfToText(buffer: Buffer): Promise<string> {
    return pdfToTextBuffer(buffer).then((buffer) => buffer.toString('utf-8'));
}
export function pdfToTextBuffer(buffer: Buffer): Promise<Buffer> {
    const inputFile = tmp.fileSync({ postfix: '.pdf' });
    const targetFileName = tmp.tmpNameSync({ postfix: '.txt' });

    fs.writeSync(inputFile.fd, buffer);

    return pdfFileToText(inputFile.name, targetFileName).then(() => {
        return readFile(targetFileName);
    });
}
