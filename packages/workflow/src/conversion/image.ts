import { log } from "@temporalio/activity";
import { execFile as execFileCallback } from "child_process";
import fs from "fs";
import { file } from "tmp-promise";
import { promisify } from "util";
const execFile = promisify(execFileCallback);

/**
 * Resizes an image to a maximum height or width using ImageMagick
 * with progressive loading when supported and colorspace correction
 * @param inputPath Input file path
 * @param max_hw Maximum height or width
 * @param format Output format
 * @param progressive Enable progressive loading for supported formats (defaults to true)
 * @param colorspaceCorrection Enable colorspace correction (defaults to true), not recommended for Q8 image magick.
 * @param colorspace Colorspace to use for processing ('RGB', 'LAB', 'LUV', 'sigmoidal') (defaults to 'RGB')
 * @returns Path to the resized image
 */
export async function imageResizer(
    inputPath: string,
    max_hw: number,
    format: string,
    progressive: boolean = true,
    colorspaceCorrection: boolean = true,
    colorspace: 'RGB' | 'LAB' | 'LUV' | 'sigmoidal' = 'RGB'
): Promise<string> {
    log.debug(`[image-resizer] Resizing image: ${inputPath} to max_hw: ${max_hw}, format: ${format}, progressive: ${progressive}, colorspaceCorrection: ${colorspaceCorrection ? colorspace : 'disabled'}`);

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
                log.debug(`Enabling interlaced ${lowerFormat.toUpperCase()} format`);
            } else if (lowerFormat === "png") {
                conversionOption = "-interlace PNG";
                log.debug(`Enabling interlaced ${lowerFormat.toUpperCase()} format`);
            } else if (lowerFormat === "gif") {
                conversionOption = "-interlace GIF";
                log.debug(`Enabling interlaced ${lowerFormat.toUpperCase()} format`);
            }
        }

        log.debug(`Resizing image using ImageMagick: ${inputPath} -> ${outputPath}`);

        const command = `convert`
        let args = [inputPath];

        // Add JPEG shrink-on-load optimization
        args.push("-define", `jpeg:size=${max_hw * 3}x${max_hw * 3}`);

        // Remove metadata
        args.push("-strip");

        // https://usage.imagemagick.org/filter/nicolas/#downsample
        // Add colorspace correction if enabled
        if (colorspaceCorrection) {
            switch (colorspace) {
                case 'RGB':
                    // Linear light, recommended default
                    // Convert from sRGB to linear RGB for processing
                    args.push("-colorspace", "RGB");
                    log.debug("Using linear RGB colorspace for resize processing");
                    break;
                case 'LAB':
                    // Perceptual linear light
                    // Use LAB colorspace which separates intensity from color
                    // Better for avoiding color clipping and distortion
                    args.push("-colorspace", "LAB");
                    log.debug("Using LAB colorspace for resize processing");
                    break;
                case 'LUV':
                    // Perceptual linear light
                    // Alternative to LAB with perceptually uniform color deltas
                    args.push("-colorspace", "LUV");
                    log.debug("Using LUV colorspace for resize processing");
                    break;
                case 'sigmoidal':
                    // Sigmoidal colorspace modification to reduce ringing artifacts
                    args.push("-colorspace", "RGB");
                    args.push("+sigmoidal-contrast", "6.5,50%");
                    log.debug("Using sigmoidal contrast modification for resize processing");
                    break;
            }
        }

        // Resize operation
        args.push("-resize", `${max_hw}x${max_hw}>`);

        // Restore colorspace after processing
        if (colorspaceCorrection) {
            switch (colorspace) {
                case 'RGB':
                case 'LAB':
                case 'LUV':
                    // Convert back to sRGB for output
                    args.push("-colorspace", "sRGB");
                    break;
                case 'sigmoidal':
                    // Restore from sigmoidal modification and convert to sRGB
                    args.push("-sigmoidal-contrast", "6.5,50%");
                    args.push("-colorspace", "sRGB");
                    break;
            }
        }

        // Add progressive/interlace options
        if (conversionOption) {
            args.push(...conversionOption.split(" "));
        }

        // Output path
        args.push(outputPath);

        log.debug(`ImageMagick command: ${command} ${args.join(" ")}`);

        const { stderr } = await execFile(command, args);

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