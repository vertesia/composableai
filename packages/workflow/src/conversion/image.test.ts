import { exec, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { dir } from 'tmp-promise';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

// Mock Temporal activity context
vi.mock('@temporalio/activity', () => ({
    log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Import after mocking
import { imageResizer } from '../conversion/image.js';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const animatedRenditionCases = [
    { sourceFormat: 'GIF', sourceFile: 'animated.gif' },
    { sourceFormat: 'WebP', sourceFile: 'animated.webp' },
] as const;
const outputFormats = ['jpeg', 'png', 'webp'] as const;

let animatedFixturesDir: string;
let cleanupAnimatedFixtures: (() => Promise<void>) | undefined;

beforeAll(async () => {
    const fixtureDir = await dir({ unsafeCleanup: true });
    animatedFixturesDir = fixtureDir.path;
    cleanupAnimatedFixtures = fixtureDir.cleanup;

    // Animated WebP requires a consistent canvas size in ImageMagick 6, which is used by CI.
    const sourceArgs = ['-delay', '10', '-size', '24x12', 'xc:red', 'xc:blue', '-loop', '0'];

    await Promise.all(
        animatedRenditionCases.map(({ sourceFile }) =>
            execFileAsync('convert', [...sourceArgs, path.join(animatedFixturesDir, sourceFile)]),
        ),
    );
    await execFileAsync('convert', [
        '-size',
        '10x10',
        'xc:red',
        '-set',
        'page',
        '40x20+5+5',
        '-delay',
        '10',
        '-size',
        '40x20',
        'xc:blue',
        '-loop',
        '0',
        path.join(animatedFixturesDir, 'optimized.gif'),
    ]);
    await fs.promises.writeFile(path.join(animatedFixturesDir, 'not-an-image.xml'), '<document />');
});

afterAll(async () => {
    await cleanupAnimatedFixtures?.();
});

describe('ImageMagick image resizing', () => {
    test('should resize an image to a maximum height or width using ImageMagick', async () => {
        const max_hw = 1596;
        const format = 'jpeg';
        const inputImagePath = path.join(__dirname, '../../fixtures', 'cat-picture.jpg');

        // Make sure the input file exists
        expect(fs.existsSync(inputImagePath)).toBe(true);

        // Call the imageResizer function with a file path
        const resizedImagePath = await imageResizer(inputImagePath, max_hw, format);

        // Make sure the output file exists
        expect(fs.existsSync(resizedImagePath)).toBe(true);

        // Use ImageMagick identify to get metadata about the resized image
        const { stdout } = await execAsync(`identify -format "%w %h %m" "${resizedImagePath}"`);
        const [width, height, imageFormat] = stdout.trim().split(' ');

        console.log({ width, height, imageFormat });

        // Check dimensions
        expect(parseInt(width, 10)).to.be.lessThanOrEqual(max_hw);
        expect(parseInt(height, 10)).to.be.lessThanOrEqual(max_hw);

        // Check format (JPEG)
        expect(imageFormat.toLowerCase()).to.equal('jpeg');
    });

    test('should throw an error for non-existent input file', async () => {
        const max_hw = 1596;
        const format = 'jpeg';
        const nonExistentPath = path.join(__dirname, 'non-existent-image.jpg');

        // Verify file doesn't exist
        expect(fs.existsSync(nonExistentPath)).toBe(false);

        // Expect the function to throw an error
        await expect(imageResizer(nonExistentPath, max_hw, format)).rejects.toThrow('Input file does not exist');
    });

    test('should throw error with empty format', async () => {
        const max_hw = 1596;
        const format = '';
        const inputImagePath = path.join(__dirname, '../../fixtures', 'cat-picture.jpg');

        // Test for empty format validation
        await expect(imageResizer(inputImagePath, max_hw, format)).rejects.toThrow('Invalid format');
    });

    test('should create progressive/interlaced image when enabled', async () => {
        const max_hw = 800;
        const format = 'jpeg';
        const inputImagePath = path.join(__dirname, '../../fixtures', 'cat-picture.jpg');

        // Make sure the input file exists
        expect(fs.existsSync(inputImagePath)).toBe(true);

        // Call the imageResizer function with progressive=true
        const resizedImagePath = await imageResizer(inputImagePath, max_hw, format, true);

        // Make sure the output file exists
        expect(fs.existsSync(resizedImagePath)).toBe(true);

        // Use ImageMagick identify to check if the image is interlaced
        const { stdout } = await execAsync(`identify -format "%[interlace]" "${resizedImagePath}"`);
        const interlaceMode = stdout.trim();

        console.log({ interlaceMode });

        // Check that interlace is enabled (should be 'JPEG' or 'Line' for progressive JPEG)
        expect(['JPEG', 'Line', 'Plane']).to.include(interlaceMode);
    });

    test('should create non-interlaced image when progressive is disabled', async () => {
        const max_hw = 800;
        const format = 'jpeg';
        const inputImagePath = path.join(__dirname, '../../fixtures', 'cat-picture.jpg');

        // Make sure the input file exists
        expect(fs.existsSync(inputImagePath)).toBe(true);

        // Call the imageResizer function with progressive=false
        const resizedImagePath = await imageResizer(inputImagePath, max_hw, format, false);

        // Make sure the output file exists
        expect(fs.existsSync(resizedImagePath)).toBe(true);

        // Use ImageMagick identify to check if the image is interlaced
        const { stdout } = await execAsync(`identify -format "%[interlace]" "${resizedImagePath}"`);
        const interlaceMode = stdout.trim().toLowerCase();

        console.log({ interlaceMode });

        // Check that interlace is disabled (should be 'none' or empty string)
        expect(['none', '']).to.include(interlaceMode);
    });

    test('should apply EXIF orientation before resizing and stripping metadata', async () => {
        const max_hw = 100;
        const format = 'jpeg';
        const inputImagePath = path.join(__dirname, '../../fixtures', 'synthetic-exif-righttop.jpg');

        // Generated from synthetic pixels with only EXIF Orientation=6 added.
        const { stdout: sourceStdout } = await execAsync(`identify -format "%w %h %[orientation]" "${inputImagePath}"`);
        const [sourceWidth, sourceHeight, sourceOrientation] = sourceStdout.trim().split(' ');
        expect(parseInt(sourceWidth, 10)).to.equal(120);
        expect(parseInt(sourceHeight, 10)).to.equal(180);
        expect(sourceOrientation).to.equal('RightTop');

        const resizedImagePath = await imageResizer(inputImagePath, max_hw, format);

        expect(fs.existsSync(resizedImagePath)).toBe(true);

        const { stdout } = await execAsync(`identify -format "%w %h %[orientation]" "${resizedImagePath}"`);
        const [width, height, orientation] = stdout.trim().split(' ');

        expect(parseInt(width, 10)).to.equal(100);
        expect(parseInt(height, 10)).to.equal(67);
        expect(['Undefined', 'TopLeft']).to.include(orientation);
    });

    test.each(
        animatedRenditionCases.flatMap(({ sourceFormat, sourceFile }) =>
            outputFormats.map((outputFormat) => ({ outputFormat, sourceFile, sourceFormat })),
        ),
    )('should render the first frame of animated $sourceFormat as one $outputFormat image', async (testCase) => {
        const maxHw = 16;
        const inputImagePath = path.join(animatedFixturesDir, testCase.sourceFile);
        const resizedImagePath = await imageResizer(inputImagePath, maxHw, testCase.outputFormat);

        try {
            expect(fs.statSync(resizedImagePath).size).toBeGreaterThan(0);

            const { stdout } = await execFileAsync('identify', ['-format', '%m %w %h %n', resizedImagePath]);
            const [imageFormat, width, height, frameCount] = stdout.trim().split(' ');

            expect(imageFormat.toLowerCase()).toBe(testCase.outputFormat);
            expect(parseInt(width, 10)).toBeLessThanOrEqual(maxHw);
            expect(parseInt(height, 10)).toBeLessThanOrEqual(maxHw);
            expect(parseInt(frameCount, 10)).toBe(1);
        } finally {
            await fs.promises.unlink(resizedImagePath);
        }
    });

    test('should render an optimized GIF first frame on its logical canvas', async () => {
        const resizedImagePath = await imageResizer(path.join(animatedFixturesDir, 'optimized.gif'), 20, 'png');

        try {
            const { stdout } = await execFileAsync('identify', ['-format', '%w %h %n', resizedImagePath]);
            expect(stdout.trim()).toBe('20 10 1');

            const { stdout: isRedDominant } = await execFileAsync('convert', [
                resizedImagePath,
                '-format',
                '%[fx:mean.r>mean.b]',
                'info:',
            ]);
            expect(isRedDominant.trim()).toBe('1');
        } finally {
            await fs.promises.unlink(resizedImagePath);
        }
    });

    test('should preserve a retryable process failure when ImageMagick cannot start', async () => {
        const originalPath = process.env.PATH;
        process.env.PATH = animatedFixturesDir;

        try {
            await expect(imageResizer(path.join(animatedFixturesDir, 'animated.gif'), 16, 'png')).rejects.toMatchObject(
                { code: 'ENOENT' },
            );
        } finally {
            process.env.PATH = originalPath;
        }
    });

    test('should classify invalid image data as a permanent conversion failure', async () => {
        const inputImagePath = path.join(animatedFixturesDir, 'not-an-image.xml');

        await expect(imageResizer(inputImagePath, 16, 'jpeg')).rejects.toMatchObject({
            type: 'ImageConversionError',
            nonRetryable: true,
        });
    });
});
