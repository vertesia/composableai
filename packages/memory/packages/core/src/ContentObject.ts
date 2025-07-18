import { manyToMarkdown, pdfToText, pdfToTextBuffer, transformImage, transformImageToBuffer } from "@vertesia/converters";
import fs from "fs";
import { PassThrough, Readable } from "stream";
import { Builder } from "./Builder.js";
import { ContentSource } from "./ContentSource.js";

export class ContentObject implements ContentSource {
    constructor(public builder: Builder, public source: ContentSource, public encoding: BufferEncoding = "utf-8") { }

    getContent(): Promise<Buffer> {
        return this.source.getContent();
    }

    getStream(): Promise<NodeJS.ReadableStream> {
        return this.source.getStream();
    }

    copyTo(entry: string) {
        this.builder.addEntry(entry, this);
    }

    async copyToFile(file: string): Promise<fs.WriteStream> {

        const input = await this.getStream();
        const out = fs.createWriteStream(file);
        const stream = input.pipe(out);
        return new Promise((resolve, reject) => {
            const handleError = (err: any) => {
                reject(err);
                out.close();
            }
            stream.on('finish', () => {
                resolve(stream);
                out.close();
            });
            input.on('error', handleError);
            stream.on('error', handleError);
        })
    }

    /**
     * Get a text representation of the object
     */
    async getText(encoding?: BufferEncoding): Promise<string> {
        const t = (await this.getContent()).toString(encoding || this.encoding);
        return t;
    }

    getJsonValue(): Promise<any> {
        return this.getText();
    }
}

export class JsonObject extends ContentObject {
    async getJsonValue(): Promise<any> {
        return JSON.parse(await this.getText());
    }
}

export interface MediaOptions {
    max_hw?: number;
    format?: "jpeg" | "png";
}
export class MediaObject extends ContentObject {
    constructor(builder: Builder, source: ContentSource, public options: MediaOptions = {}) {
        super(builder, source);
        this.encoding = "base64";
    }
    async getStream(): Promise<NodeJS.ReadableStream> {
        const stream = await super.getStream();
        const out = new PassThrough();
        await transformImage(stream, out, this.options);
        return out;
    }
    async getContent(): Promise<Buffer> {
        const stream = await super.getStream();
        return await transformImageToBuffer(stream, this.options);
    }
}


export class PdfObject extends ContentObject {
    constructor(builder: Builder, source: ContentSource) {
        super(builder, source);
    }
    async getStream(): Promise<NodeJS.ReadableStream> {
        return Readable.from(await this.getContent());
    }
    async getContent(): Promise<Buffer> {
        return pdfToTextBuffer(await super.getContent());
    }
    async getText(): Promise<string> {
        return await pdfToText(await super.getContent());
    }
}


export class DocxObject extends ContentObject {
    constructor(builder: Builder, source: ContentSource) {
        super(builder, source);
    }
    async getBuffer(): Promise<Buffer> {
        return Buffer.from(await manyToMarkdown(await this.getStream(), "docx"), "utf-8");
    }
    async getStream(): Promise<NodeJS.ReadableStream> {
        const stream = new PassThrough();
        stream.end(await this.getBuffer());
        return stream;
    }
    async getText(): Promise<string> {
        return await manyToMarkdown(await this.getStream(), "docx");
    }

}
