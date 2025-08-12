import { Builder } from "../Builder.js";
import { DocxObject, MediaObject, MediaOptions, PdfObject } from "../ContentObject.js";
import { AbstractContentSource, ContentSource, FileSource, SourceSpec } from "../ContentSource.js";
import { createPathRewrite, PathMapperFn } from "../utils/rewrite.js";

function rewritePath(source: ContentSource, index: number, mapper: PathMapperFn) {
    const path = source instanceof FileSource ? source.file : '';
    return mapper(path, index);
}

export interface CopyOptions {
    media?: MediaOptions;
    extractText?: boolean | string;
}
export function copy(builder: Builder, source: SourceSpec, toPath: string, options: CopyOptions = {}) {
    const resolved = AbstractContentSource.resolve(source);
    const mapperFn = createPathRewrite(toPath);
    if (Array.isArray(resolved)) {
        for (let i = 0, l = resolved.length; i < l; i++) {
            const cs = resolved[i];
            copyOne(builder, cs, rewritePath(cs, i, mapperFn), options);
        }
    } else {
        return copyOne(builder, resolved, rewritePath(resolved, 0, mapperFn), options);
    }
}

function copyOne(builder: Builder, source: ContentSource, toPath: string, options: CopyOptions) {
    if (options.media) {
        new MediaObject(builder, source, options.media).copyTo(toPath);
    } else if (options.extractText) {
        let type = options.extractText;
        if (typeof type === "boolean") {
            if (source instanceof FileSource) {
                type = source.extname ? source.extname.slice(1) : source.extname;
            } else {
                throw new Error("source type for extractText must be specified");
            }
        }
        switch (type) {
            case "pdf":
                new PdfObject(builder, source).copyTo(toPath);
                break;
            case "docx":
                new DocxObject(builder, source).copyTo(toPath);
                break;
            default:
                throw new Error("Unsupported extractText type: " + type);
        }
    } else {
        builder.addEntry(toPath, source);
    }
}
