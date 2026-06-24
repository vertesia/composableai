import fs from 'node:fs';
import path from 'node:path';
import sharp, { type FormatEnum } from 'sharp';
import { expect, test } from 'vitest';
import { createImageTransformer } from './image.js';

test('should resize an image to a maximum height or width', async () => {
    const max_hw = 1596;
    const format: keyof FormatEnum = 'jpeg';
    const imageFile = fs.readFileSync(path.join(__dirname, '../fixtures', 'cat-picture.jpg'));

    const sh = createImageTransformer(imageFile, { max_hw, format });

    const buffer = await sh.toBuffer();
    const metadata = await sharp(buffer).metadata();

    console.log(metadata);
    //await sh.toFile('./cat-picture.jpg');

    expect(metadata.width).to.be.lessThanOrEqual(max_hw);
    expect(metadata.height).to.be.lessThanOrEqual(max_hw);
    expect(metadata.format).to.equal(format);
});
