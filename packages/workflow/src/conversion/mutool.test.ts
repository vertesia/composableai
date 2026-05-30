import { MockActivityEnvironment } from '@temporalio/testing';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, expect, test } from 'vitest';
import { mutoolPdfToText, pdfExtractPages, pdfToImages } from './mutool.js';

let activityContext: MockActivityEnvironment;

beforeAll(async () => {
    activityContext = new MockActivityEnvironment();
});

const TIMEOUT = 60000;

test(
    'should convert pdf to text with mutool',
    async () => {
        const pdf = fs.readFileSync(path.join(__dirname, '../../fixtures', 'test-pdf1.pdf'));
        const buf = Buffer.from(pdf);
        console.log('Running mutoolPdfToText');
        const result: string = await activityContext.run(mutoolPdfToText, buf);
        expect(result).toContain('VF primarily uses foreign currency exchange');
    },
    TIMEOUT,
);

test(
    'should convert pdf to images with mutool',
    async () => {
        const filename = path.join(__dirname, '../../fixtures', 'test-pdf1.pdf');

        console.log('Running pdfToImages');
        const result: string[] = await activityContext.run(pdfToImages, filename);
        console.log(result);

        expect(result).toBeInstanceOf(Array);
        expect(result.length).toBe(119);
    },
    TIMEOUT,
);

test(
    'should convert pdf to images with pages using mutool',
    async () => {
        const filename = path.join(__dirname, '../../fixtures', 'test-pdf1.pdf');
        const pages = [7, 8, 9];

        console.log('Running pdfToImages with pages');
        const result: string[] = await activityContext.run(pdfToImages, filename, pages);
        console.log(result);

        expect(result).toBeInstanceOf(Array);
        expect(result.length).toBe(3);
    },
    TIMEOUT,
);

test(
    'should extract 3 pages from PDF into new PDF with mutool',
    async () => {
        const filename = path.join(__dirname, '../../fixtures', 'test-pdf1.pdf');
        const pages = [7, 8, 9];

        console.log('Running pdfGetPages');
        const result: string = await activityContext.run(pdfExtractPages, filename, pages);
        console.log(result);

        expect(result).toContain('.pdf');
    },
    TIMEOUT,
);

test(
    'should extract 1 page from PDF into new PDF with mutool',
    async () => {
        const filename = path.join(__dirname, '../../fixtures', 'test-pdf1.pdf');
        const pages = [12];

        console.log('Running pdfGetPages');
        const result: string = await activityContext.run(pdfExtractPages, filename, pages);
        console.log(result);

        expect(result).toContain('.pdf');
    },
    TIMEOUT,
);
