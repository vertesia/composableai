import { execFile } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import tmp from 'tmp';

const execFileAsync = promisify(execFile);

/** Bound on the mutool output kept in memory; a tool that writes more fails instead of growing the buffer. */
const MUTOOL_MAX_BUFFER = 10 * 1024 * 1024;

/**
 * Convert a PDF file to a text file with mutool. Its output is drained, so a chatty run cannot block on a full pipe,
 * and a non-zero exit or a kill by a signal rejects with mutool's stderr.
 */
export async function pdfFileToText(input: string, output: string): Promise<string> {
    await execFileAsync('mutool', ['convert', '-o', output, input], { maxBuffer: MUTOOL_MAX_BUFFER });
    return output;
}
export function pdfToText(buffer: Buffer): Promise<string> {
    return pdfToTextBuffer(buffer).then((buffer) => buffer.toString('utf-8'));
}
export async function pdfToTextBuffer(buffer: Buffer): Promise<Buffer> {
    const inputFile = tmp.tmpNameSync({ postfix: '.pdf' });
    const targetFileName = tmp.tmpNameSync({ postfix: '.txt' });

    try {
        await writeFile(inputFile, buffer, { flag: 'wx', mode: 0o600 });
    } catch (err: unknown) {
        // 'wx' refuses a path that already exists, which is not ours to remove; any other failure may leave a partial file.
        if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
            await removeTempFiles(inputFile);
        }
        throw err;
    }
    try {
        await pdfFileToText(inputFile, targetFileName);
        return await readFile(targetFileName);
    } finally {
        await removeTempFiles(inputFile, targetFileName);
    }
}

/**
 * Remove temporary files, ignoring ones that are already gone. A failure is reported, never thrown, so cleanup
 * cannot replace the conversion's result or error.
 */
async function removeTempFiles(...files: string[]): Promise<void> {
    await Promise.all(
        files.map((file) =>
            rm(file, { force: true }).catch((err: unknown) => {
                console.warn('Failed to remove temporary file', file, err);
            }),
        ),
    );
}
