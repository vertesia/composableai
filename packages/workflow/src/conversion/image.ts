import { execFile as execFileCallback } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';
import { log } from '@temporalio/activity';
import { tmpName } from 'tmp-promise';
import { ImageConversionError } from '../errors.js';
import { currentActivitySignal } from '../utils/activity-info.js';
import { cpuSlotEnv, withCpuSlot } from '../utils/cpu-slots.js';

const execFile = promisify(execFileCallback);

function isCommandExitError(error: unknown): error is Error & { code: number } {
    return error instanceof Error && 'code' in error && typeof error.code === 'number';
}

interface FirstFrameGeometry {
    /** Stored width and height, before any EXIF orientation is applied. */
    width: number;
    height: number;
    /** Whether the frame is smaller than, or offset on, its page canvas (an optimized GIF or WebP subframe). */
    needsCanvas: boolean;
}

/**
 * Reads the geometry of the first frame. `identify -ping` reads it from the header without decoding pixels.
 */
async function readFirstFrameGeometry(inputPath: string): Promise<FirstFrameGeometry> {
    const { stdout } = await execFile('identify', ['-ping', '-format', '%W %H %w %h %X %Y', `${inputPath}[0]`], {
        env: cpuSlotEnv(),
    });
    const [pageWidth, pageHeight, width, height, offsetX, offsetY] = stdout.trim().split(/\s+/);
    return {
        width: Number.parseInt(width, 10),
        height: Number.parseInt(height, 10),
        needsCanvas:
            pageWidth !== width ||
            pageHeight !== height ||
            Number.parseInt(offsetX, 10) !== 0 ||
            Number.parseInt(offsetY, 10) !== 0,
    };
}

/**
 * The `jpeg:size` shrink-on-load hint, or undefined when the image is already small enough. Only the JPEG decoder
 * reads it; other formats ignore it.
 *
 * ImageMagick derives the decode scale from the smaller of the two ratios between the stored size and the hint, so
 * a hint with another aspect ratio than the image is limited by its short side: a square hint on a wide image
 * enlarges the decode instead of shrinking it. ImageMagick has no aspect-preserving form of this define, so scale
 * the stored size until its long side is 3 * max_hw. Rounding the short side down keeps the long side's ratio the
 * smaller one.
 */
function jpegSizeHint({ width, height }: FirstFrameGeometry, max_hw: number): string | undefined {
    const target = max_hw * 3;
    const longSide = Math.max(width, height);
    if (!(longSide > target)) {
        return undefined;
    }
    const scaled = (side: number) => Math.max(1, Math.floor((side * target) / longSide));
    return `${scaled(width)}x${scaled(height)}`;
}

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
    colorspace: 'RGB' | 'LAB' | 'LUV' | 'sigmoidal' = 'RGB',
): Promise<string> {
    log.debug(
        `[image-resizer] Resizing image: ${inputPath} to max_hw: ${max_hw}, format: ${format}, progressive: ${progressive}, colorspaceCorrection: ${colorspaceCorrection ? colorspace : 'disabled'}`,
    );

    const allowedFormats = ['jpg', 'jpeg', 'png', 'webp'];

    if (!format || format.trim() === '') {
        throw new Error(`Invalid format: ${format}.Supported : ${allowedFormats.join(', ')}`);
    }

    //check that max_hw is valid
    if (!Number.isInteger(max_hw) || max_hw <= 0) {
        throw new Error(`Invalid max_hw value: ${max_hw}`);
    }

    //check that inputPath exists
    // Create a temporary file
    // The caller owns the returned path and removes it, so reserve a name rather than keep a descriptor or a tmp cleanup
    // registration for it. Create the file exclusively and private (0600) before ImageMagick writes into it; this stays
    // outside the cleanup below so a failed create never removes another process's file.
    const outputPath = await tmpName({ postfix: `.${format}` });
    await (await fs.promises.open(outputPath, 'wx', 0o600)).close();
    try {
        // Check if input file exists
        if (!fs.existsSync(inputPath)) {
            throw new ImageConversionError(`Input file does not exist: ${inputPath}`);
        }
        // Validate max_hw
        if (!Number.isInteger(max_hw) || max_hw <= 0) {
            throw new Error(`Invalid max_hw value: ${max_hw}`);
        }

        // Progressive loading options
        let conversionOption = '';

        // Only add progressive option for formats that support it
        if (progressive) {
            // JPEG and some other formats support progressive loading
            const lowerFormat = format.toLowerCase();
            if (lowerFormat === 'jpg' || lowerFormat === 'jpeg') {
                conversionOption = '-interlace JPEG';
                log.debug(`Enabling interlaced ${lowerFormat.toUpperCase()} format`);
            } else if (lowerFormat === 'png') {
                conversionOption = '-interlace PNG';
                log.debug(`Enabling interlaced ${lowerFormat.toUpperCase()} format`);
            } else if (lowerFormat === 'gif') {
                conversionOption = '-interlace GIF';
                log.debug(`Enabling interlaced ${lowerFormat.toUpperCase()} format`);
            }
        }

        log.debug(`Resizing image using ImageMagick: ${inputPath} -> ${outputPath}`);

        // One CPU slot for both ImageMagick commands, so a resize waits for a slot once.
        const { stderr } = await withCpuSlot(async () => {
            const command = 'convert';
            const geometry = await readFirstFrameGeometry(inputPath);
            const args: string[] = [];
            const sizeHint = jpegSizeHint(geometry, max_hw);
            if (sizeHint) {
                args.push('-define', `jpeg:size=${sizeHint}`);
            }

            // Renditions are single images. Explicitly select the first frame so animated GIF/WebP inputs do not
            // expand into numbered sibling files while leaving the requested output path empty.
            // Keep the selector after the JPEG shrink-on-load optimization so ImageMagick can apply it while decoding.
            args.push(`${inputPath}[0]`);

            // Place an optimized animation subframe on its logical canvas before resizing. Only when needed: -coalesce
            // copies the decoded frame, which can exhaust the pixel cache on a large image that already fills its canvas.
            if (geometry.needsCanvas) {
                args.push('-coalesce');
            }

            // Apply EXIF orientation to pixels before stripping metadata or resizing.
            args.push('-auto-orient');

            // Remove metadata
            args.push('-strip');

            // https://usage.imagemagick.org/filter/nicolas/#downsample
            // Add colorspace correction if enabled
            if (colorspaceCorrection) {
                switch (colorspace) {
                    case 'RGB':
                        // Linear light, recommended default
                        // Convert from sRGB to linear RGB for processing
                        args.push('-colorspace', 'RGB');
                        log.debug('Using linear RGB colorspace for resize processing');
                        break;
                    case 'LAB':
                        // Perceptual linear light
                        // Use LAB colorspace which separates intensity from color
                        // Better for avoiding color clipping and distortion
                        args.push('-colorspace', 'LAB');
                        log.debug('Using LAB colorspace for resize processing');
                        break;
                    case 'LUV':
                        // Perceptual linear light
                        // Alternative to LAB with perceptually uniform color deltas
                        args.push('-colorspace', 'LUV');
                        log.debug('Using LUV colorspace for resize processing');
                        break;
                    case 'sigmoidal':
                        // Sigmoidal colorspace modification to reduce ringing artifacts
                        args.push('-colorspace', 'RGB');
                        args.push('+sigmoidal-contrast', '6.5,50%');
                        log.debug('Using sigmoidal contrast modification for resize processing');
                        break;
                }
            }

            // Resize operation
            args.push('-resize', `${max_hw}x${max_hw}>`);

            // Restore colorspace after processing
            if (colorspaceCorrection) {
                switch (colorspace) {
                    case 'RGB':
                    case 'LAB':
                    case 'LUV':
                        // Convert back to sRGB for output
                        args.push('-colorspace', 'sRGB');
                        break;
                    case 'sigmoidal':
                        // Restore from sigmoidal modification and convert to sRGB
                        args.push('-sigmoidal-contrast', '6.5,50%');
                        args.push('-colorspace', 'sRGB');
                        break;
                }
            }

            // Add progressive/interlace options
            if (conversionOption) {
                args.push(...conversionOption.split(' '));
            }

            // Output path
            args.push(outputPath);

            log.debug(`ImageMagick command: ${command} ${args.join(' ')}`);

            return execFile(command, args, { env: cpuSlotEnv() });
        }, currentActivitySignal());

        if (stderr) {
            log.warn(`ImageMagick warning: ${stderr}`);
        }

        // Verify output exists and has content
        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
            throw new ImageConversionError(`ImageMagick conversion failed: output file not created or empty`);
        }

        return outputPath;
    } catch (error: unknown) {
        await fs.promises.rm(outputPath, { force: true }).catch((cleanupError: unknown) => {
            log.warn('Failed to clean temporary image output after conversion failure', { cleanupError });
        });

        // No log here: the thrown error carries the message and the caller logs it with its context.
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (error instanceof ImageConversionError) {
            throw error;
        }

        if (!isCommandExitError(error)) {
            throw error;
        }

        throw new ImageConversionError(`Image conversion failed: ${errorMessage}`, error);
    }
}
