import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { expect, test, vi, describe } from 'vitest';

// Mock Temporal activity context
vi.mock('@temporalio/activity', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Import after mocking
import { imageResizer } from '../conversion/image';

const execAsync = promisify(exec);

describe('ImageMagick image resizing', () => {
  test('should resize an image to a maximum height or width using ImageMagick', async () => {
    const max_hw = 1024;
    const format = 'jpeg';
    const inputImagePath = path.join(__dirname, '../../fixtures', 'cat-picture.jpg');
    
    // Make sure the input file exists
    expect(fs.existsSync(inputImagePath)).toBe(true);

    // Call the imageResizer function with a file path
    const resizedImagePath = await imageResizer(inputImagePath, max_hw, format);
    
    // Make sure the output file exists
    expect(fs.existsSync(resizedImagePath)).toBe(true);
    
    // Use ImageMagick identify to get metadata about the resized image
    const { stdout } = await execAsync(`magick identify -format "%w %h %m" "${resizedImagePath}"`);
    const [width, height, imageFormat] = stdout.trim().split(' ');
    
    console.log({ width, height, imageFormat });
    
    // Check dimensions
    expect(parseInt(width)).to.be.lessThanOrEqual(max_hw);
    expect(parseInt(height)).to.be.lessThanOrEqual(max_hw);
    
    // Check format (JPEG)
    expect(imageFormat.toLowerCase()).to.equal('jpeg');
  });

  test('should throw an error for non-existent input file', async () => {
    const max_hw = 1024;
    const format = 'jpeg';
    const nonExistentPath = path.join(__dirname, 'non-existent-image.jpg');
    
    // Verify file doesn't exist
    expect(fs.existsSync(nonExistentPath)).toBe(false);
    
    // Expect the function to throw an error
    await expect(imageResizer(nonExistentPath, max_hw, format))
      .rejects
      .toThrow('Input file does not exist');
  });

  test('should throw error with invalid format', async () => {
    const max_hw = 1024;
    const format = 'non-existent-format';
    const inputImagePath = path.join(__dirname, '../../fixtures', 'cat-picture.jpg');
    
    // This test should now pass because we're validating formats
    await expect(imageResizer(inputImagePath, max_hw, format))
      .rejects
      .toThrow('Invalid format');
  });
  
  test('intentionally failing test for demonstration', async () => {
    // Force a failing assertion for demo purposes
    expect('actual').toBe('expected');
  });
});
