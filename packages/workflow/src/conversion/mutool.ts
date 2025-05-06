import { log } from '@temporalio/activity';
import { spawn } from 'child_process';
import fs from 'fs';
import tmp from 'tmp';



/**
 * Convert a pdf file to text
 * TODO: pass file reference instead of Buffer
 */

export function mutoolPdfToText(buffer: Buffer): Promise<string> {

    const inputFile = tmp.fileSync({ postfix: '.pdf' });
    const targetFileName = tmp.tmpNameSync({ postfix: '.txt' });

    fs.writeSync(inputFile.fd, buffer);

    return new Promise((resolve, reject) => {


        log.info("Converting pdf to text", { inputFile: inputFile.name, targetFileName });

        const command = spawn("mutool", ["convert", "-o", targetFileName, inputFile.name]);

        command.on('exit', function (code) {
            if (code) {
                reject(new Error(`mutool exited with code ${code}`));
            }
        });


        command.on('close', function (code) {
            if (code) {
                reject(new Error(`mutool exited with code ${code}`));
            } else {
                return fs.readFile(targetFileName, 'utf8', (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    return resolve(data);
                });
            };
        });

        command.on('error', (err) => {
            reject(err);
        });

    });

}

/**
 * 
 * Convert a pdf files to images (one image per page), as PNG format
 * 
 * @param file 
 * @param pages
 * @returns  
 */
export async function pdfToImages(file: Buffer | string, pages?: number[]): Promise<string[]> {

    const workDir = tmp.dirSync();
    log.info(`Converting pdf to images`, { workDir: workDir.name, input_type: typeof file, pages });

    if (file instanceof Buffer) {
        fs.writeFileSync(`${workDir.name}/input.pdf`, file);
    }
    const filename = typeof file === 'string' ? file : `${workDir.name}/input.pdf`;

    const args = [
        "draw", 
        "-o", `${workDir.name}/page-%d.png`,
        filename,
    ];

    if (pages) {
        args.push(pages.join(','));
    }

    return new Promise((resolve, reject) => {

        const command = spawn("mutool", args);
        log.info(`Executing mutool command`, { workDir: workDir.name, filename, command: command.spawnargs });

        let errors = '';

        command.stderr.on('data', (data) => {
            errors += data;
        });

        command.on('exit', function (code) {

            if (code) {
                log.error(`mutool exited with code ${code}`, { errors });
                reject(new Error(`mutool exited with code ${code}`));
            }
        });

        command.on('close', function (code) {
            if (code) {
                reject(new Error(`mutool finished with code ${code}`));
            } else {
                const files = fs.readdirSync(workDir.name);
                const images = files.filter(f => f.endsWith('.png')).map(f => `${workDir.name}/${f}`);
                log.info(`Converted pdf to ${images.length} images`, files);
                return resolve(images);
            };
        });

        command.on('error', (err) => {
            reject(err);
        });

    });

}


/**
 * Get some pages from a PDF to create a new one
 */

export async function pdfExtractPages(file: Buffer | string, pages: number[]): Promise<string> {

    const workDir = tmp.dirSync();
    log.info(`Getting pages from pdf`, { workDir: workDir.name, input_type: typeof file, pages });

    if (file instanceof Buffer) {
        fs.writeFileSync(`${workDir.name}/input.pdf`, file);
    }
    const filename = typeof file === 'string' ? file : `${workDir.name}/input.pdf`;

    const args = [
        "merge",
        "-o", `${workDir.name}/output.pdf`,
        "-O", "garbage=compact,sanitize",
        filename,
        pages.join(','),
    ];

    return new Promise((resolve, reject) => {

        const command = spawn("mutool", args);
        log.info(`Executing mutool command`, { workDir: workDir.name, filename, command: command.spawnargs });

        let errors = '';

        command.stderr.on('data', (data) => {
            errors += data;
        });

        command.on('exit', function (code) {

            if (code) {
                log.error(`mutool exited with code ${code}`, { errors });
                reject(new Error(`mutool exited with code ${code}`));
            }
        });

        command.on('close', function (code) {
            if (code) {
                reject(new Error(`mutool finished with code ${code}`));
            } else {
                const file = `${workDir.name}/output.pdf`;
                log.info(`Extracted pages from pdf`, { pages, file });
                return resolve(file);
            };
        });

        command.on('error', (err) => {
            reject(err);
        });

    });


}