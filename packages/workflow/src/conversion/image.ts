
import { log } from "@temporalio/activity";
import { exec as execCallback } from 'child_process';
import fs from 'fs';
import { file } from 'tmp-promise';
import { promisify } from 'util';

const exec = promisify(execCallback);

/**
 * Resizes an image to a maximum height or width using ImageMagick
 * @param inputPath Input file path
 * @param max_hw Maximum height or width
 * @param format Output format
 * @returns Path to the resized image
 */
export async function imageResizer(inputPath: string, max_hw: number, format: string): Promise<string> {
    // Create a temporary file
    const { path: outputPath, cleanup } = await file({ postfix: `.${format}` });

    try {
        // Check if input file exists
        if (!fs.existsSync(inputPath)) {
            throw new Error(`Input file does not exist: ${inputPath}`);
        }

        // Validate max_hw
        if (!Number.isInteger(max_hw) || max_hw <= 0) {
            throw new Error(`Invalid max_hw value: ${max_hw}`);
        }

        log.info(`Resizing image using ImageMagick: ${inputPath} -> ${outputPath}`);

        // Execute ImageMagick command
        const { stderr } = await exec(`magick convert "${inputPath}" -resize "${max_hw}x${max_hw}>" "${outputPath}"`);

        if (stderr) {
            log.warn(`ImageMagick warning: ${stderr}`);
        }

        // Verify output exists and has content
        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
            throw new Error(`ImageMagick conversion failed: output file not created or empty`);
        }

        return outputPath;
    } catch (error) {
        // Clean up the temporary file
        await cleanup();

        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error(`Image conversion failed: ${errorMessage}`);
        throw new Error(`Image conversion failed: ${errorMessage}`);
    }
}

