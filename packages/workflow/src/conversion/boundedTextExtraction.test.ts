import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { MockActivityEnvironment } from '@temporalio/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CANONICAL_TEXT_EXTRACTION_LIMITS, extractCanonicalTextFromBuffer } from './boundedTextExtraction.js';
import { mutoolPdfToText } from './mutool.js';

vi.mock('node:child_process', async (original) => {
    const actual = await original<typeof import('node:child_process')>();
    return { ...actual, spawn: vi.fn(actual.spawn) };
});
const actualChildProcess = await vi.importActual<typeof import('node:child_process')>('node:child_process');
beforeEach(() => {
    vi.mocked(spawn).mockReset().mockImplementation(actualChildProcess.spawn);
});
afterEach(() => vi.useRealTimers());

function pdf(text: string, pageCount = 1, pageWidth = 300): Buffer {
    const stream = `BT /F1 18 Tf 40 200 Td (${text}) Tj ET`;
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        `<< /Type /Pages /Count ${pageCount} /Kids [${Array.from({ length: pageCount }, (_value, index) => `${index + 5} 0 R`).join(' ')}] >>`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
        ...Array.from(
            { length: pageCount },
            () =>
                `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} 300] /Resources << /Font << /F1 3 0 R >> >> /Contents 4 0 R >>`,
        ),
    ];
    let content = '%PDF-1.4\n';
    const offsets: number[] = [0];
    for (const [index, object] of objects.entries()) {
        offsets.push(Buffer.byteLength(content));
        content += `${index + 1} 0 obj\n${object}\nendobj\n`;
    }
    const xref = Buffer.byteLength(content);
    content += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets.slice(1)) content += `${String(offset).padStart(10, '0')} 00000 n \n`;
    content += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(content);
}

describe('bounded canonical document text extraction', () => {
    it('preserves exact UTF8 and BOM without inferred tokens or identity', async () => {
        const input = Buffer.from('\uFEFF héllo\n\t世界 ');
        expect(await extractCanonicalTextFromBuffer(input, 'text/plain')).toEqual({
            text: '\uFEFF héllo\n\t世界 ',
            backend: { id: 'utf8', version: '1' },
        });
    });

    it('rejects malformed UTF8 rather than replacing bytes', async () => {
        await expect(extractCanonicalTextFromBuffer(Buffer.from([0xc3]), 'text/plain')).rejects.toMatchObject({
            reason: 'invalid_document',
        });
    });

    it('enforces text output size before returning a result', async () => {
        await expect(
            extractCanonicalTextFromBuffer(
                Buffer.alloc(CANONICAL_TEXT_EXTRACTION_LIMITS.output_bytes + 1),
                'text/plain',
            ),
        ).rejects.toMatchObject({ reason: 'limit_exceeded' });
    });

    it('does not interpret binary or MIME claims as text', async () => {
        await expect(extractCanonicalTextFromBuffer(Buffer.from('not a pdf'), 'application/pdf')).rejects.toMatchObject(
            {
                reason: 'invalid_document',
            },
        );
        await expect(extractCanonicalTextFromBuffer(Buffer.from([137, 80, 78, 71]), 'image/png')).rejects.toMatchObject(
            {
                reason: 'unsupported_format',
            },
        );
    });

    it('extracts actual decoded PDF text and backend version using the installed mutool', async () => {
        const result = await extractCanonicalTextFromBuffer(pdf('Canonical bounded PDF'), 'application/pdf');
        expect(result.pages).toBe(1);
        expect(result.text).toContain('Canonical bounded PDF');
        expect(vi.mocked(spawn).mock.calls.find((call) => call[1]?.[0] === 'draw')?.[1]).toEqual([
            'draw',
            '-F',
            'txt',
            '-q',
            expect.stringMatching(/input\.pdf$/),
            '1-1',
        ]);
        expect(result.backend.id).toBe('mutool');
        expect(result.backend.version).toMatch(/^mutool version \d+\.\d+(?:\.\d+)?$/);
    });

    it('keeps the existing mutool entry and opts canonical execution into bounds', async () => {
        const env = new MockActivityEnvironment();
        expect(await env.run(mutoolPdfToText, pdf('Legacy conversion'))).toContain('Legacy conversion');
        expect(await mutoolPdfToText(pdf('Canonical conversion'), {})).toContain('Canonical conversion');
    });

    it('rejects an actual decoder malformed page tree', async () => {
        const input = await readFile(new URL('../../fixtures/test-pdf2.pdf', import.meta.url));
        await expect(extractCanonicalTextFromBuffer(input, 'application/pdf')).rejects.toMatchObject({
            reason: 'invalid_document',
        });
    });

    it('owns source bytes and heartbeat callback before asynchronous decoder work', async () => {
        const input = pdf('Owned source');
        const first = vi.fn();
        const options = { heartbeat: first };
        const pending = extractCanonicalTextFromBuffer(input, 'application/pdf', options);
        input.fill(0);
        options.heartbeat = vi.fn(() => {
            throw new Error('mutated callback');
        });
        expect((await pending).text).toContain('Owned source');
    });

    it('does not launch a decoder for cancelled input', async () => {
        const controller = new AbortController();
        controller.abort(new Error('cancelled before work'));
        await expect(
            extractCanonicalTextFromBuffer(pdf('Cancelled'), 'application/pdf', { signal: controller.signal }),
        ).rejects.toThrow('cancelled before work');
    });
});

it('rejects a real PDF exceeding the page bound before text conversion', async () => {
    await expect(extractCanonicalTextFromBuffer(pdf('Too many pages', 501), 'application/pdf')).rejects.toMatchObject({
        reason: 'limit_exceeded',
    });
    expect(vi.mocked(spawn).mock.calls.map((call) => call[1]?.[0])).toEqual(['-v', 'info']);
});

it('bounds actual decoded PDF output independently of source size and page count', async () => {
    const input = pdf('x'.repeat(6_000), 400, 100_000);
    expect(input.byteLength).toBeLessThan(CANONICAL_TEXT_EXTRACTION_LIMITS.input_bytes);
    await expect(extractCanonicalTextFromBuffer(input, 'application/pdf')).rejects.toMatchObject({
        reason: 'limit_exceeded',
    });
    expect(vi.mocked(spawn).mock.calls.map((call) => call[1]?.[0])).toEqual(['-v', 'info', 'draw']);
});

it('rejects oversized source bytes before starting a decoder', async () => {
    await expect(
        extractCanonicalTextFromBuffer(
            Buffer.alloc(CANONICAL_TEXT_EXTRACTION_LIMITS.input_bytes + 1),
            'application/pdf',
        ),
    ).rejects.toMatchObject({ reason: 'limit_exceeded' });
    expect(spawn).not.toHaveBeenCalled();
});

it('kills a noncooperating decoder at the operation deadline and removes heartbeat timers', async () => {
    vi.useFakeTimers();
    const child = actualChildProcess.spawn('python', ['-c', 'import time; time.sleep(60)'], {
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    const kill = vi.spyOn(child, 'kill');
    vi.mocked(spawn).mockImplementationOnce(() => child);
    const pending = extractCanonicalTextFromBuffer(pdf('Stalled decoder'), 'application/pdf');
    const rejection = expect(pending).rejects.toMatchObject({ reason: 'deadline_exceeded' });
    await vi.advanceTimersByTimeAsync(30_000);
    await rejection;
    expect(kill).toHaveBeenCalledWith('SIGKILL');
    expect(vi.getTimerCount()).toBe(0);
});

it('cancels an active decoder without an extraction result', async () => {
    const child = actualChildProcess.spawn('python', ['-c', 'import time; time.sleep(60)'], {
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    const kill = vi.spyOn(child, 'kill');
    vi.mocked(spawn).mockImplementationOnce(() => child);
    const controller = new AbortController();
    const pending = extractCanonicalTextFromBuffer(pdf('Cancelled decoder'), 'application/pdf', {
        signal: controller.signal,
    });
    const rejection = expect(pending).rejects.toMatchObject({ reason: 'cancelled' });
    controller.abort();
    await rejection;
    expect(kill).toHaveBeenCalledWith('SIGKILL');
});

it('bounds ignored version stdout as well as captured decoder output', async () => {
    vi.mocked(spawn).mockImplementationOnce(() =>
        actualChildProcess.spawn('python', ['-c', 'import os,time; os.write(1,b"a"*131072); time.sleep(60)'], {
            stdio: ['ignore', 'pipe', 'pipe'],
        }),
    );
    await expect(extractCanonicalTextFromBuffer(pdf('No output flood'), 'application/pdf')).rejects.toMatchObject({
        reason: 'limit_exceeded',
    });
});

it('snapshots heartbeat ownership before a real delayed child and later PDF decoding', async () => {
    vi.mocked(spawn).mockImplementationOnce(() =>
        actualChildProcess.spawn(
            'python',
            ['-c', 'import os,time; time.sleep(1.1); os.write(2,b"mutool version 1.28.0")'],
            { stdio: ['ignore', 'pipe', 'pipe'] },
        ),
    );
    const original = vi.fn();
    const replacement = vi.fn(() => {
        throw new Error('mutated heartbeat');
    });
    const options = { heartbeat: original };
    const pending = extractCanonicalTextFromBuffer(pdf('Exact callback'), 'application/pdf', options);
    options.heartbeat = replacement;
    expect((await pending).text).toContain('Exact callback');
    expect(original).toHaveBeenCalledWith(expect.objectContaining({ stage: 'inspect' }));
    expect(replacement).not.toHaveBeenCalled();
});
