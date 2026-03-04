import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { expect, test, vi, describe } from "vitest";

// Mock Temporal activity context
vi.mock("@temporalio/activity", () => ({
    log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Import after mocking
import { imageResizer } from "../conversion/image";

const execAsync = promisify(exec);

describe("ImageMagick image resizing", () => {
    test("should resize an image to a maximum height or width using ImageMagick", async () => {
        const max_hw = 1596;
        const format = "jpeg";
        const inputImagePath = path.join(__dirname, "../../fixtures", "cat-picture.jpg");

        // Make sure the input file exists
        expect(fs.existsSync(inputImagePath)).toBe(true);

        // Call the imageResizer function with a file path
        const resizedImagePath = await imageResizer(inputImagePath, max_hw, format);

        // Make sure the output file exists
        expect(fs.existsSync(resizedImagePath)).toBe(true);

        // Use ImageMagick identify to get metadata about the resized image
        const { stdout } = await execAsync(`identify -format "%w %h %m" "${resizedImagePath}"`);
        const [width, height, imageFormat] = stdout.trim().split(" ");

        console.log({ width, height, imageFormat });

        // Check dimensions
        expect(parseInt(width)).to.be.lessThanOrEqual(max_hw);
        expect(parseInt(height)).to.be.lessThanOrEqual(max_hw);

        // Check format (JPEG)
        expect(imageFormat.toLowerCase()).to.equal("jpeg");
    });

    test("should throw an error for non-existent input file", async () => {
        const max_hw = 1596;
        const format = "jpeg";
        const nonExistentPath = path.join(__dirname, "non-existent-image.jpg");

        // Verify file doesn't exist
        expect(fs.existsSync(nonExistentPath)).toBe(false);

        // Expect the function to throw an error
        await expect(imageResizer(nonExistentPath, max_hw, format)).rejects.toThrow("Input file does not exist");
    });

    test("should throw error with empty format", async () => {
        const max_hw = 1596;
        const format = "";
        const inputImagePath = path.join(__dirname, "../../fixtures", "cat-picture.jpg");

        // Test for empty format validation
        await expect(imageResizer(inputImagePath, max_hw, format)).rejects.toThrow("Invalid format");
    });

    test("should create progressive/interlaced image when enabled", async () => {
        const max_hw = 800;
        const format = "jpeg";
        const inputImagePath = path.join(__dirname, "../../fixtures", "cat-picture.jpg");

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
        expect(["JPEG", "Line", "Plane"]).to.include(interlaceMode);
    });

    test("should create non-interlaced image when progressive is disabled", async () => {
        const max_hw = 800;
        const format = "jpeg";
        const inputImagePath = path.join(__dirname, "../../fixtures", "cat-picture.jpg");

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
        expect(["none", ""]).to.include(interlaceMode);
    });
});
