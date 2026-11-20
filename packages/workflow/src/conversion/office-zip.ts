import { open } from 'node:fs/promises';

/** An entry of a zip file's central directory. */
export interface ZipEntry {
    name: string;
    /** The size the entry declares once decompressed, in bytes. */
    uncompressedSize: number;
}

const EOCD_SIGNATURE = 0x06054b50;
const EOCD_SIZE = 22;
const EOCD_MAX_COMMENT = 0xffff;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_LOCATOR_SIZE = 20;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const ZIP64_EOCD_SIZE = 56;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const CENTRAL_HEADER_SIZE = 46;
const ZIP64_EXTRA_ID = 0x0001;
const U16_MAX = 0xffff;
const U32_MAX = 0xffffffff;

/** A central directory larger than this is not an Office document's, which lists a few hundred entries at most. */
const MAX_CENTRAL_DIRECTORY_BYTES = 16 * 1024 * 1024;

/** The file is not a zip file, or its central directory cannot be read. */
export class InvalidZipError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidZipError';
    }
}

/**
 * Read the entries of a zip file's central directory, without decompressing anything.
 *
 * The sizes are the ones the directory declares. A reader that trusts the directory, as Python's `zipfile` does, never
 * produces more than the declared size of an entry, so their sum bounds what it decompresses even when the data lies.
 *
 * The directory is located from its end record, as `zipfile` does, so data prepended to the archive does not hide it.
 * `zipfile` reads entries until it has consumed the directory's declared length, whatever entry count the end record
 * states, so the whole directory is read here too, and a count that disagrees with it is refused: otherwise entries
 * past the count would decompress without being counted.
 *
 * @throws InvalidZipError when the file has no readable central directory
 */
export async function readZipEntries(file: string): Promise<ZipEntry[]> {
    const handle = await open(file, 'r');
    try {
        const { size } = await handle.stat();
        const read = async (position: number, length: number): Promise<Buffer> => {
            if (position < 0 || length < 0 || position + length > size) {
                throw new InvalidZipError('Zip directory points outside the file');
            }
            const buffer = Buffer.alloc(length);
            const { bytesRead } = await handle.read(buffer, 0, length, position);
            if (bytesRead !== length) {
                throw new InvalidZipError('Zip file ended early');
            }
            return buffer;
        };

        const tailLength = Math.min(size, EOCD_SIZE + EOCD_MAX_COMMENT);
        const tailStart = size - tailLength;
        const tail = await read(tailStart, tailLength);
        const eocdOffset = findEndRecord(tail);
        if (eocdOffset < 0) {
            throw new InvalidZipError('No zip end of central directory record');
        }
        const eocdPosition = tailStart + eocdOffset;
        let entryCount = tail.readUInt16LE(eocdOffset + 10);
        let directorySize = tail.readUInt32LE(eocdOffset + 12);
        // Where the directory ends: right before the end record, or before the ZIP64 records when they are present.
        let directoryEnd = eocdPosition;

        if (entryCount === U16_MAX || directorySize === U32_MAX || tail.readUInt32LE(eocdOffset + 16) === U32_MAX) {
            const locatorPosition = eocdPosition - ZIP64_LOCATOR_SIZE;
            const locator = await read(locatorPosition, ZIP64_LOCATOR_SIZE);
            if (locator.readUInt32LE(0) !== ZIP64_LOCATOR_SIGNATURE) {
                throw new InvalidZipError('No ZIP64 end of central directory locator');
            }
            const zip64Position = locatorPosition - ZIP64_EOCD_SIZE;
            const zip64 = await read(zip64Position, ZIP64_EOCD_SIZE);
            if (zip64.readUInt32LE(0) !== ZIP64_EOCD_SIGNATURE) {
                throw new InvalidZipError('No ZIP64 end of central directory record');
            }
            entryCount = toSafeNumber(zip64.readBigUInt64LE(32));
            directorySize = toSafeNumber(zip64.readBigUInt64LE(40));
            directoryEnd = zip64Position;
        }

        if (directorySize > MAX_CENTRAL_DIRECTORY_BYTES) {
            throw new InvalidZipError(`Zip central directory is ${directorySize} bytes`);
        }
        const directory = await read(directoryEnd - directorySize, directorySize);
        return parseCentralDirectory(directory, entryCount);
    } finally {
        await handle.close();
    }
}

/** Offset of the last end of central directory record in `tail`, or -1. */
function findEndRecord(tail: Buffer): number {
    for (let offset = tail.length - EOCD_SIZE; offset >= 0; offset--) {
        if (tail.readUInt32LE(offset) === EOCD_SIGNATURE) {
            return offset;
        }
    }
    return -1;
}

function parseCentralDirectory(directory: Buffer, entryCount: number): ZipEntry[] {
    const entries: ZipEntry[] = [];
    let offset = 0;
    while (offset < directory.length) {
        if (offset + CENTRAL_HEADER_SIZE > directory.length) {
            throw new InvalidZipError('Zip central directory ended early');
        }
        if (directory.readUInt32LE(offset) !== CENTRAL_HEADER_SIGNATURE) {
            throw new InvalidZipError('Bad zip central directory entry');
        }
        let uncompressedSize = directory.readUInt32LE(offset + 24);
        const nameLength = directory.readUInt16LE(offset + 28);
        const extraLength = directory.readUInt16LE(offset + 30);
        const commentLength = directory.readUInt16LE(offset + 32);
        const nameStart = offset + CENTRAL_HEADER_SIZE;
        const extraStart = nameStart + nameLength;
        const next = extraStart + extraLength + commentLength;
        if (next > directory.length) {
            throw new InvalidZipError('Zip central directory ended early');
        }
        if (uncompressedSize === U32_MAX) {
            // The ZIP64 extra field holds the real size; it lists the uncompressed size first.
            uncompressedSize = readZip64UncompressedSize(directory.subarray(extraStart, extraStart + extraLength));
        }
        entries.push({
            name: directory.toString('utf8', nameStart, extraStart),
            uncompressedSize,
        });
        offset = next;
    }
    if (entries.length !== entryCount) {
        throw new InvalidZipError(`Zip directory holds ${entries.length} entries, its end record says ${entryCount}`);
    }
    return entries;
}

function readZip64UncompressedSize(extra: Buffer): number {
    let offset = 0;
    while (offset + 4 <= extra.length) {
        const id = extra.readUInt16LE(offset);
        const length = extra.readUInt16LE(offset + 2);
        if (id === ZIP64_EXTRA_ID && length >= 8 && offset + 4 + 8 <= extra.length) {
            return toSafeNumber(extra.readBigUInt64LE(offset + 4));
        }
        offset += 4 + length;
    }
    throw new InvalidZipError('Zip entry has no ZIP64 size');
}

function toSafeNumber(value: bigint): number {
    // Sizes beyond 2^53 cannot be real; reporting the largest safe size keeps them over every limit.
    return value > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(value);
}
