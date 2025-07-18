import { createReadStream } from "fs";
import { readFile } from "fs/promises";
import { globSync } from 'glob';
import { basename, extname, resolve } from "path";
import { Readable } from "stream";

export interface ContentSource {
    getContent(): Promise<Buffer>;
    getStream(): Promise<NodeJS.ReadableStream>;
}

export type SourceSpec = string | ContentSource;
export abstract class AbstractContentSource implements ContentSource {
    abstract getContent(): Promise<Buffer>

    async getStream(): Promise<NodeJS.ReadableStream> {
        return Readable.from(await this.getContent());
    }

    static resolve(source: SourceSpec): ContentSource | ContentSource[] {
        if (typeof source === 'string') {
            return FileSource.resolve(source);
        } else if (source instanceof AbstractContentSource) {
            return source;
        }
        throw new Error("Unsupported content source: " + source);
    }
}

export class BufferSource extends AbstractContentSource {
    constructor(public buffer: Buffer) {
        super()
    }
    getContent(): Promise<Buffer> {
        return Promise.resolve(this.buffer);
    }
}

export class TextSource extends AbstractContentSource {
    constructor(public value: string, public encoding: BufferEncoding = "utf-8") {
        super();
    }

    getContent() {
        return Promise.resolve(Buffer.from(this.value, this.encoding));
    }
}

export class FileSource extends AbstractContentSource {
    file: string;
    constructor(file: string, resolvePath = true) {
        super();
        this.file = resolvePath ? resolve(file) : file;
    }

    get path() {
        return this.file;
    }

    get name() {
        return basename(this.file);
    }

    get extname() {
        return extname(this.file);
    }

    get nameWithoutExt() {
        return this.name.slice(0, -this.extname.length);
    }

    getContent() {
        return readFile(this.file);
    }

    async getStream(): Promise<NodeJS.ReadableStream> {
        return createReadStream(this.file);
    }

    static resolve(location: string): FileSource | FileSource[] {
        if (location.includes('*')) {
            return globSync(location, { absolute: true, withFileTypes: false }).map(f => new FileSource(f));
        } else {
            return new FileSource(location);
        }
    }

}
