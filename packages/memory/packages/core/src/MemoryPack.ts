import micromatch from 'micromatch';
import { extname } from "path";
import { AbstractContentSource } from "./ContentSource.js";
import { loadTarIndex, TarEntryIndex, TarIndex } from "./utils/tar.js";

export const MEMORY_METADATA_ENTRY = "metadata.json";

const EXPORT_CONTENT_KEY = '@content:';
const EXPORT_ENTRY_KEY = '@file:';
const EXPORT_PROPERTY_KEY = '@';
const mediaExtensions = new Set([".jpg", ".jpeg", ".png"])

/**
 * Projection cannot contains both include and exclude keys
 */
export interface ProjectionProperties {
    [key: string]: boolean | 0 | 1;
}

function applyProjection(projection: ProjectionProperties, object: any) {
    const keys = Object.keys(projection);
    if (keys.length < 1) {
        return object;
    }
    const isInclusion = !!projection[keys[0]];
    const out: any = {};
    if (isInclusion) {
        for (const key of Object.keys(object)) {
            if (projection[key]) {
                out[key] = object[key];
            }
        }
    } else {
        for (const key of Object.keys(object)) {
            const value = projection[key];
            if (value === undefined || value) {
                out[key] = object[key];
            }
        }
    }
    return out;
}


export abstract class MemoryPack {
    abstract getMetadata(projection?: ProjectionProperties): Promise<Record<string, any>>;
    abstract getEntry(path: string): MemoryEntry | null;
    abstract getEntryContent(path: string): Promise<Buffer | null>;
    abstract getEntryText(path: string, encoding?: BufferEncoding): Promise<string | null>;
    abstract getPaths(filters?: string[]): string[];
    abstract getEntries(filters?: string[]): MemoryEntry[];
    abstract getEntriesContent(filters?: string[]): Promise<Buffer[]>;
    abstract getEntriesText(filters?: string[], encoding?: BufferEncoding): Promise<string[]>;

    async exportObject(mapping: Record<string, any>): Promise<Record<string, any>> {
        let metadata: any;
        const result: Record<string, any> = {};
        for (const key of Object.keys(mapping)) {
            const value = mapping[key];
            if (value === '@') {
                if (!metadata) {
                    metadata = await this.getMetadata();
                }
                if (key === '@') {
                    Object.assign(result, metadata);
                } else {
                    result[key] = metadata;
                }
            } else if (value.startsWith(EXPORT_CONTENT_KEY)) {
                const selector = value.slice(EXPORT_CONTENT_KEY.length);
                if (selector.includes('*')) {
                    result[key] = await this.getEntriesText([selector]);
                } else {
                    result[key] = await this.getEntryText(selector);
                }
            } else if (value.startsWith(EXPORT_ENTRY_KEY)) {
                const selector = value.slice(EXPORT_ENTRY_KEY.length);
                if (selector.includes('*')) {
                    const entries = this.getEntries([selector]);
                    result[key] = await Promise.all(entries.map(entry => entry.getText().then(content => ({ name: entry.name, content }))));
                } else {
                    const entry = this.getEntry(selector);
                    result[key] = entry ? { name: entry.name, content: await entry.getText() } : null;
                }
            } else if (value.startsWith(EXPORT_PROPERTY_KEY)) {
                if (!metadata) {
                    metadata = await this.getMetadata();
                }
                const accessor = value.substring(EXPORT_PROPERTY_KEY.length);
                result[key] = resolveProperty(metadata, accessor);
            } else {
                result[key] = value;
            }
        }
        return result;
    }
}


export class MemoryEntry extends AbstractContentSource {
    constructor(public index: TarIndex, public name: string, public offset: number, public size: number) {
        super();
    }
    getContent(): Promise<Buffer> {
        return this.index.getContentAt(this.offset, this.size);
    }
    getText(encoding: BufferEncoding = "utf-8"): Promise<string> {
        return this.getContent().then((b) => b.toString(encoding));
    }
}

export class TarMemoryPack extends MemoryPack {
    constructor(public index: TarIndex) {
        super();
        if (!index.get(MEMORY_METADATA_ENTRY)) {
            throw new Error("Invalid memory tar file. Context entry not found");
        }
    }
    async getMetadata(projection?: ProjectionProperties): Promise<Record<string, any>> {
        const content = await this.index.getContent(MEMORY_METADATA_ENTRY);
        if (content) {
            let metadata = JSON.parse(content.toString('utf-8'));
            if (projection) {
                metadata = applyProjection(projection, metadata);
            }
            return metadata;
        } else {
            throw new Error("Invalid memory tar file. Context entry not found");
        }
    }

    getPaths(filters?: string[]) {
        let paths = this.index.getSortedPaths();
        if (filters && filters.length > 0) {
            paths = micromatch(paths, filters);
        }
        return paths;
    }

    getEntries(filters?: string[]) {
        return this._getEntries(this.getPaths(filters));
    }

    private _getEntries(paths: string[]) {
        const entries: MemoryEntry[] = [];
        const index = this.index;
        for (const path of paths) {
            const entry: TarEntryIndex = index.get(path);
            entries.push(new MemoryEntry(index, path, entry.offset, entry.size));
        }
        return entries;
    }

    getEntriesContent(filters?: string[]) {
        const paths = this.getPaths(filters);
        const promises: Promise<Buffer>[] = [];
        for (const path of paths) {
            promises.push(this.getEntryContent(path) as Promise<Buffer>);
        }
        return Promise.all(promises);
    }

    getEntriesText(filters?: string[], encoding?: BufferEncoding) {
        const paths = this.getPaths(filters);
        const promises: Promise<string>[] = [];
        for (const path of paths) {
            promises.push(this.getEntryText(path, encoding) as Promise<string>);
        }
        return Promise.all(promises);
    }

    getEntry(path: string) {
        const entry = this.index.get(path);
        return entry ? new MemoryEntry(this.index, path, entry.offset, entry.size) : null;
    }

    getEntryContent(path: string): Promise<Buffer | null> {
        const entry = this.index.get(path);
        if (!entry) {
            return Promise.resolve(null);
        } else {
            return this.index.getContentAt(entry.offset, entry.size);
        }
    }

    getEntryText(path: string, encoding?: BufferEncoding): Promise<string | null> {
        return this.getEntryContent(path).then((b) => b?.toString(encoding || getTextEncodingForPath(path)) || null);
    }

    static async loadFile(file: string) {
        const index = await loadTarIndex(file);
        if (!index) {
            throw new Error("Invalid memory tar file. Cannot load index");
        }
        return new TarMemoryPack(index);
    }

}


export function loadMemoryPack(location: string): Promise<MemoryPack> {
    // TODO we only support file paths as location for now
    return TarMemoryPack.loadFile(location);
}

function getTextEncodingForPath(path: string) {
    const ext = extname(path);
    return mediaExtensions.has(ext) ? "base64" : "utf-8";
}


function resolveProperty(obj: Record<string, any>, key: string) {
    if (key.includes('.')) {
        const keys = key.split('.');
        let value = obj;
        for (const k of keys) {
            value = value[k];
            if (value == undefined) {
                return undefined;
            }
        }
        return value;
    } else {
        return obj[key];
    }
}