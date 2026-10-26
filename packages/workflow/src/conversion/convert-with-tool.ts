import fs from 'node:fs';
import { log } from '@temporalio/activity';
import tmp from 'tmp';
import { execActivityFile } from '../activities/media/exec.js';
import { removeTempFiles } from '../utils/blobs.js';

/** Bound on the tool output kept in memory; a tool that writes more fails instead of growing the buffer. */
const TOOL_MAX_BUFFER = 10 * 1024 * 1024;

/**
 * Write `input` to a temporary file, run `tool` with the arguments built by `args(inputFile, outputFile)`, and
 * return the output file's text. Both temporary files are removed whatever the outcome.
 *
 * @param inputExt extension of the input file, with or without the leading dot (e.g. `docx`)
 * @param outputExt extension of the output file, with or without the leading dot (e.g. `md`)
 */
export async function convertWithTool(
    tool: string,
    input: Buffer,
    inputExt: string | undefined,
    outputExt: string,
    args: (inputFile: string, outputFile: string) => string[],
): Promise<string> {
    const inputFile = tmp.tmpNameSync({ postfix: toPostfix(inputExt) });
    const outputFile = tmp.tmpNameSync({ postfix: toPostfix(outputExt) });

    await writeNewFile(inputFile, input);
    try {
        log.info(`Converting with ${tool}`, { inputFile, outputFile });
        await runTool(tool, args(inputFile, outputFile));
        return await fs.promises.readFile(outputFile, 'utf8');
    } finally {
        await removeTempFiles(inputFile, outputFile);
    }
}

/**
 * Run a conversion tool inside the current activity. Its output is drained (so a chatty tool cannot block on a full
 * pipe), its stderr is part of the error when it fails or is killed, and it is stopped when the activity is cancelled
 * or about to time out.
 */
export async function runTool(tool: string, args: string[]): Promise<void> {
    await execActivityFile(tool, args, { maxBuffer: TOOL_MAX_BUFFER });
}

/**
 * Create `file` with `data`, failing if it already exists. Only a file this call created is removed on failure.
 */
export async function writeNewFile(file: string, data: Buffer): Promise<void> {
    try {
        await fs.promises.writeFile(file, data, { flag: 'wx', mode: 0o600 });
    } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
            await removeTempFiles(file);
        }
        throw err;
    }
}

function toPostfix(ext: string | undefined): string {
    return ext ? `.${ext.replace(/^\./, '')}` : '';
}
