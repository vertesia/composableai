import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { pdfToText } from './mutool.js';


test('[mutool] should convert pdf to text', async () => {
  const pdf = fs.readFileSync(path.join(__dirname, '../fixtures', 'test-pdf2.pdf'));
  const buf = Buffer.from(pdf);
  console.log("Running mutoolPdfToText")
  const result: string = await pdfToText(buf);
  expect(result).toContain('its attentive Ambassadors');

});
