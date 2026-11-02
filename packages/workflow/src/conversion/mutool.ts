import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { log } from '@temporalio/activity';
import { removeTempFiles } from '../utils/blobs.js';
import { convertWithTool, runTool } from './convert-with-tool.js';

/**
 * Convert a pdf file to text
 *
 * @param file the PDF, or the path of a PDF file, which keeps a large PDF out of memory
 */
export function mutoolPdfToText(file: Buffer | string): Promise<string> {
    return convertWithTool('mutool', file, 'pdf', 'txt', (inputFile, outputFile) => [
        'convert',
        '-o',
        outputFile,
        inputFile,
    ]);
}

/**
 *
 * Convert a pdf files to images (one image per page), as PNG format
 *
 * @param file
 * @param pages
 * @returns the image paths, inside a work directory the caller owns and must remove
 */
export async function pdfToImages(file: Buffer | string, pages?: number[]): Promise<string[]> {
    return withMutoolWorkDir(async (workDir) => {
        log.info(`Converting pdf to images`, { workDir, input_type: typeof file, pages });
        const filename = await inputPdfPath(workDir, file);

        const args = ['draw', '-o', path.join(workDir, 'page-%d.png'), filename];
        if (pages) {
            args.push(pages.join(','));
        }
        await runTool('mutool', args);

        const files = await fs.promises.readdir(workDir);
        const images = files.filter((f) => f.endsWith('.png')).map((f) => path.join(workDir, f));
        log.info(`Converted pdf to ${images.length} images`, files);
        return images;
    });
}

/**
 * Get some pages from a PDF to create a new one
 *
 * @returns the new PDF's path, and the work directory holding it, which the caller owns and must remove
 */
export async function pdfExtractPages(
    file: Buffer | string,
    pages: number[],
): Promise<{ file: string; workDir: string }> {
    return withMutoolWorkDir(async (workDir) => {
        log.info(`Getting pages from pdf`, { workDir, input_type: typeof file, pages });
        const filename = await inputPdfPath(workDir, file);

        const output = path.join(workDir, 'output.pdf');
        await runTool('mutool', ['merge', '-o', output, '-O', 'garbage=compact,sanitize', filename, pages.join(',')]);

        log.info(`Extracted pages from pdf`, { pages, file: output });
        return { file: output, workDir };
    });
}

/**
 * Run `work` in a new work directory. The directory is removed if `work` fails; on success the caller owns it.
 */
async function withMutoolWorkDir<T>(work: (workDir: string) => Promise<T>): Promise<T> {
    // mkdtemp rather than tmp.dirSync: the directory is removed by path, which would leave a tmp cleanup registration
    // behind for the life of the process.
    const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mutool-'));
    try {
        return await work(workDir);
    } catch (err: unknown) {
        log.error('mutool conversion failed', { workDir, err });
        await removeTempFiles(workDir);
        throw err;
    }
}

async function inputPdfPath(workDir: string, file: Buffer | string): Promise<string> {
    if (typeof file === 'string') {
        return file;
    }
    const input = path.join(workDir, 'input.pdf');
    await fs.promises.writeFile(input, file);
    return input;
}
