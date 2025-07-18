import { Builder } from "./Builder.js";
import { ContentSource } from "./ContentSource.js";
import { MEMORY_METADATA_ENTRY, MemoryPack, ProjectionProperties } from "./MemoryPack.js";
import { normalizePath, TarBuilder } from "./utils/tar.js";

export interface FromOptions {
    files?: string[];
    projection?: ProjectionProperties;
}

export class MemoryPackBuilder {
    baseMetadata: Record<string, any> = {};
    entries: { [path: string]: ContentSource } = {};

    constructor(public builder: Builder) {
    }

    async load(memory: MemoryPack, options: FromOptions = {}) {
        const files = options.files || [];
        // do not fetch the context entry an the metadata.json file
        files.push(`!${MEMORY_METADATA_ENTRY}`);
        const entries = memory.getEntries(files);
        for (const entry of entries) {
            this.add(entry.name, entry);
        }
        this.baseMetadata = await memory.getMetadata(options.projection);
    }

    add(path: string, content: ContentSource) {
        path = normalizePath(path);
        this.entries[path] = content;
    }

    async build(file: string, metadata: object) {
        metadata = { ...this.baseMetadata, ...metadata };
        if (!file.endsWith('.tar')) {
            file += '.tar';
        }
        if (this.builder.options.gzip) {
            file += ".gz";
        }
        const tar = new TarBuilder(file);
        const keys = Object.keys(this.entries).sort();
        for (const key of keys) {
            const source = this.entries[key];
            tar.add(key, await source.getContent());
        }
        tar.add(MEMORY_METADATA_ENTRY, Buffer.from(
            JSON.stringify(metadata, undefined, this.builder.options.indent || undefined),
            "utf-8")
        );
        await tar.build();
        return file;
    }
}
