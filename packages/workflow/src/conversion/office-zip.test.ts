import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InvalidZipError, readZipEntries } from './office-zip.js';

const FIXTURES = fileURLToPath(new URL('../../fixtures/', import.meta.url));

interface FixtureEntry {
    name: string;
    /** Stored as is, without compression. */
    data?: Buffer;
    /** The uncompressed size the central directory declares, when it is not the data's length. */
    declaredSize?: number;
    /** Declare the size in a ZIP64 extra field, as a writer does for an entry over 4 GiB. */
    zip64?: boolean;
}

/**
 * Build a zip of stored entries. The central directory can declare any size, which is all {@link readZipEntries}
 * reads; the local headers and data only make the file a well-formed zip.
 */
function buildZip(entries: FixtureEntry[], { prefix = Buffer.alloc(0) } = {}): Buffer {
    const locals: Buffer[] = [];
    const centrals: Buffer[] = [];
    let offset = prefix.length;
    for (const entry of entries) {
        const name = Buffer.from(entry.name, 'utf8');
        const data = entry.data ?? Buffer.alloc(0);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(name.length, 26);
        locals.push(local, name, data);

        const size = entry.declaredSize ?? data.length;
        const extra = Buffer.alloc(entry.zip64 ? 12 : 0);
        if (entry.zip64) {
            extra.writeUInt16LE(0x0001, 0);
            extra.writeUInt16LE(8, 2);
            extra.writeBigUInt64LE(BigInt(size), 4);
        }
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt32LE(data.length, 20);
        central.writeUInt32LE(entry.zip64 ? 0xffffffff : size, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt16LE(extra.length, 30);
        central.writeUInt32LE(offset, 42);
        centrals.push(central, name, extra);
        offset += local.length + name.length + data.length;
    }
    const directory = Buffer.concat(centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([prefix, ...locals, directory, end]);
}

describe('readZipEntries', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-zip-test-'));
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    function write(data: Buffer): string {
        const file = path.join(tempDir, 'input.docx');
        fs.writeFileSync(file, data);
        return file;
    }

    it('should list the parts of a real DOCX', async () => {
        const entries = await readZipEntries(path.join(FIXTURES, 'us-ciia.docx'));

        const document = entries.find((entry) => entry.name === 'word/document.xml');
        expect(document?.uncompressedSize).toBeGreaterThan(0);
        expect(entries.map((entry) => entry.name)).toContain('[Content_Types].xml');
    });

    it('should report the sizes the central directory declares', async () => {
        const file = write(
            buildZip([
                { name: 'word/document.xml', data: Buffer.from('<w:document/>'), declaredSize: 300 * 1024 * 1024 },
                { name: 'word/media/image1.png', data: Buffer.from('png') },
            ]),
        );

        await expect(readZipEntries(file)).resolves.toEqual([
            { name: 'word/document.xml', uncompressedSize: 300 * 1024 * 1024 },
            { name: 'word/media/image1.png', uncompressedSize: 3 },
        ]);
    });

    it('should read a size from the ZIP64 extra field', async () => {
        const file = write(buildZip([{ name: 'ppt/slides/slide1.xml', declaredSize: 5 * 1024 ** 3, zip64: true }]));

        await expect(readZipEntries(file)).resolves.toEqual([
            { name: 'ppt/slides/slide1.xml', uncompressedSize: 5 * 1024 ** 3 },
        ]);
    });

    it('should find the directory of a zip with data prepended', async () => {
        const file = write(
            buildZip([{ name: 'word/document.xml', data: Buffer.from('x') }], { prefix: Buffer.alloc(100) }),
        );

        await expect(readZipEntries(file)).resolves.toEqual([{ name: 'word/document.xml', uncompressedSize: 1 }]);
    });

    it('should reject a file that is not a zip', async () => {
        const file = write(Buffer.from('garbage, not an Office document'));

        await expect(readZipEntries(file)).rejects.toBeInstanceOf(InvalidZipError);
    });

    it('should reject an empty file', async () => {
        await expect(readZipEntries(write(Buffer.alloc(0)))).rejects.toBeInstanceOf(InvalidZipError);
    });

    it('should reject a directory that claims more entries than it holds', async () => {
        const zip = buildZip([{ name: 'word/document.xml', data: Buffer.from('x') }]);
        // Entry count of the end record, which is the last 22 bytes.
        zip.writeUInt16LE(2, zip.length - 22 + 10);

        await expect(readZipEntries(write(zip))).rejects.toBeInstanceOf(InvalidZipError);
    });

    it('should reject an end record that counts fewer entries than the directory holds', async () => {
        // zipfile reads the directory to its declared length, so it would decompress the uncounted entry.
        const zip = buildZip([
            { name: 'word/document.xml', data: Buffer.from('x') },
            { name: 'word/media/huge.bin', data: Buffer.from('y'), declaredSize: 3 * 1024 ** 3 },
        ]);
        zip.writeUInt16LE(1, zip.length - 22 + 8);
        zip.writeUInt16LE(1, zip.length - 22 + 10);

        await expect(readZipEntries(write(zip))).rejects.toThrow('holds 2 entries, its end record says 1');
    });

    it('should reject a directory that points outside the file', async () => {
        const zip = buildZip([{ name: 'word/document.xml', data: Buffer.from('x') }]);
        // Directory size of the end record.
        zip.writeUInt32LE(zip.length * 2, zip.length - 22 + 12);

        await expect(readZipEntries(write(zip))).rejects.toBeInstanceOf(InvalidZipError);
    });
});
