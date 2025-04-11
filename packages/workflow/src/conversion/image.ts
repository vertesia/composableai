import { log } from "@temporalio/activity";
import { execFile as execFileCallback } from "child_process";
import fs from "fs";
import { file } from "tmp-promise";
import { promisify } from "util";
const execFile = promisify(execFileCallback);

/**
 * Resizes an image to a maximum height or width using ImageMagick
 * with progressive loading when supported
 * @param inputPath Input file path
 * @param max_hw Maximum height or width
 * @param format Output format
 * @param progressive Enable progressive loading for supported formats (defaults to true)
 * @returns Path to the resized image
 */
export async function imageResizer(
    inputPath: string,
    max_hw: number,
    format: string,
    progressive: boolean = true,
): Promise<string> {
    const allowedFormats = ["jpg", "jpeg", "png", "webp"];

    if (!format || format.trim() === "") {
        throw new Error(`Invalid format: ${format}.Supported : ${allowedFormats.join(", ")}`);
    }

    //check that max_hw is valid
    if (!Number.isInteger(max_hw) || max_hw <= 0) {
        throw new Error(`Invalid max_hw value: ${max_hw}`);
    }

    //check that inputPath exists
    if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file does not exist: ${inputPath}`);
    }

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

        // Progressive loading options
        let conversionOption = "";

        // Only add progressive option for formats that support it
        if (progressive) {
            // JPEG and some other formats support progressive loading
            const lowerFormat = format.toLowerCase();
            if (lowerFormat === "jpg" || lowerFormat === "jpeg") {
                conversionOption = "-interlace JPEG";
                log.info(`Enabling interlaced ${lowerFormat.toUpperCase()} format`);
            } else if (lowerFormat === "png") {
                conversionOption = "-interlace PNG";
                log.info(`Enabling interlaced ${lowerFormat.toUpperCase()} format`);
            } else if (lowerFormat === "gif") {
                conversionOption = "-interlace GIF";
                log.info(`Enabling interlaced ${lowerFormat.toUpperCase()} format`);
            }
        }

        log.info(`Resizing image using ImageMagick: ${inputPath} -> ${outputPath}`);

        const { stderr } = await execFile("magick", [
            "convert",
            inputPath,
            "-resize",
            `${max_hw}x${max_hw}>`,
            ...(conversionOption ? conversionOption.split(" ") : []),
            outputPath,
        ]);

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
