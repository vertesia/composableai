import { MockActivityEnvironment } from '@temporalio/testing';
import fs from 'fs';
import path from 'path';
import { beforeAll, expect, test } from 'vitest';
import { mutoolPdfToText, pdfExtractPages, pdfToImages } from './mutool.js';

let activityContext: MockActivityEnvironment;

beforeAll(async () => {
  activityContext = new MockActivityEnvironment();
});

const TIMEOUT = 10000;

test('[mutool] should convert pdf to text', async () => {
  const pdf = fs.readFileSync(path.join(__dirname, '../../fixtures', 'test-pdf1.pdf'));
  const buf = Buffer.from(pdf);
  console.log("Running mutoolPdfToText")
  const result = await activityContext.run(mutoolPdfToText, buf);
  expect(result).toContain('VF primarily uses foreign currency exchange');
 
}, TIMEOUT);

test('[mutool] should convert pdf to images', async () => {
  const filename = path.join(__dirname, '../../fixtures', 'test-pdf1.pdf');
  
  console.log("Running pdfToImages")
  const result = await activityContext.run(pdfToImages, filename);
  console.log(result);

  expect(result).toBeInstanceOf(Array);
  expect((result as string[]).length).toBe(119);

}, TIMEOUT); 

test('[mutool] should convert pdf to images with pages', async () => {
  const filename = path.join(__dirname, '../../fixtures', 'test-pdf1.pdf');
  const pages = [7, 8, 9];
  
  console.log("Running pdfToImages with pages")
  const result = await activityContext.run(pdfToImages, filename, pages);
  console.log(result);

  expect(result).toBeInstanceOf(Array);
  expect((result as string[]).length).toBe(3);

}, TIMEOUT);

test('[mutool] should extract 3 pages from PDF into new PDF', async () => {
  const filename = path.join(__dirname, '../../fixtures', 'test-pdf1.pdf');
  const pages = [7, 8, 9];
  
  console.log("Running pdfGetPages")
  const result = await activityContext.run(pdfExtractPages, filename, pages);
  console.log(result);

  expect(result).toContain(".pdf");

}, TIMEOUT);

test('[mutool] should extract 1 pages from PDF into new PDF', async () => {
  const filename = path.join(__dirname, '../../fixtures', 'test-pdf1.pdf');
  const pages = [12];
  
  console.log("Running pdfGetPages")
  const result = await activityContext.run(pdfExtractPages, filename, pages);
  console.log(result);

  expect(result).toContain(".pdf");

}, TIMEOUT);