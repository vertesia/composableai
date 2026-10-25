import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MockActivityEnvironment } from '@temporalio/testing';
import type { VertesiaClient } from '@vertesia/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pdfExtractPages } from '../conversion/mutool.js';
import { setupActivity } from '../dsl/setup/ActivityContext.js';
import { createPdfDocumentFromSource } from './createDocumentFromOther.js';

vi.mock('../conversion/mutool.js', () => ({ pdfExtractPages: vi.fn() }));
vi.mock('../dsl/setup/ActivityContext.js', () => ({ setupActivity: vi.fn() }));

type Payload = Parameters<typeof createPdfDocumentFromSource>[0];

describe('createPdfDocumentFromSource', () => {
    let root: string;

    beforeEach(() => {
        vi.clearAllMocks();
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'create-pdf-from-source-'));
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    function setup(upload: () => Promise<unknown>) {
        // The output sits below the work directory, so removing its parent directory would leave the work directory.
        const workDir = path.join(root, 'work');
        const file = path.join(workDir, 'nested', 'output.pdf');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, '%PDF pages');

        const client = {
            files: { downloadFile: vi.fn().mockResolvedValue(new Blob(['%PDF source']).stream()) },
            objects: {
                retrieve: vi.fn().mockResolvedValue({
                    id: 'object-1',
                    content: { source: 'gs://bucket/source.pdf', type: 'application/pdf' },
                }),
                upload: vi.fn(upload),
                create: vi.fn().mockResolvedValue({ id: 'object-2' }),
            },
            types: { getTypeByName: vi.fn().mockResolvedValue({ id: 'type-1', name: 'Pages' }) },
        } as unknown as VertesiaClient;
        vi.mocked(setupActivity).mockResolvedValue({
            client,
            objectId: 'object-1',
            params: { target_object_type: 'Pages', title: 'Pages', pages: [1, 2] } satisfies Payload['params'],
        } as unknown as Awaited<ReturnType<typeof setupActivity>>);
        vi.mocked(pdfExtractPages).mockResolvedValue({ file, workDir });
        return { workDir };
    }

    const payload = {} as Payload;

    it('removes the work directory pdfExtractPages reports after the upload', async () => {
        const { workDir } = setup(async () => ({ source: 'gs://bucket/pages.pdf', name: 'pages-1-2.pdf' }));

        const result = await new MockActivityEnvironment().run(createPdfDocumentFromSource, payload);

        expect(result).toEqual({ newObjectId: 'object-2', uploadedFile: 'pages-1-2.pdf' });
        expect(fs.existsSync(workDir)).toBe(false);
        // The downloaded source is removed once the pages are extracted.
        const source = vi.mocked(pdfExtractPages).mock.calls[0]?.[0];
        expect(source).toBeDefined();
        expect(fs.existsSync(path.dirname(source as string))).toBe(false);
    });

    it('removes the work directory when the upload fails', async () => {
        const { workDir } = setup(async () => {
            throw new Error('upload failed');
        });

        await expect(new MockActivityEnvironment().run(createPdfDocumentFromSource, payload)).rejects.toThrow(
            'upload failed',
        );
        expect(fs.existsSync(workDir)).toBe(false);
        const source = vi.mocked(pdfExtractPages).mock.calls[0]?.[0];
        expect(source).toBeDefined();
        expect(fs.existsSync(path.dirname(source as string))).toBe(false);
    });
});
