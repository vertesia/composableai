import { AsyncObjectWalker } from "@vertesia/json";
import { mkdtempSync, rmSync } from "fs";
import os from "os";
import { join, resolve } from "path";
import { copy, CopyOptions } from "./commands/copy.js";
import { exec, ExecOptions } from "./commands/exec.js";
import { ContentObject, DocxObject, JsonObject, MediaObject, MediaOptions, PdfObject } from "./ContentObject.js";
import { AbstractContentSource, ContentSource, SourceSpec, TextSource } from "./ContentSource.js";
import { loadMemoryPack } from "./MemoryPack.js";
import { FromOptions, MemoryPackBuilder } from "./MemoryPackBuilder.js";

export interface BuildOptions {
    indent?: number;
    /**
     * the path to save the output. Defaults to 'memory.tar'.
     * If no .tar extension is present it will be added
     */
    out?: string;

    /**
     * If set, suppress logs. Defaults to false.
     */
    quiet?: boolean;

    /**
     * If true, compress the output (tar or json) with gzip. Defaults to false.
     */
    gzip?: boolean;

    /**
     * Vars to be injected into the script context as the vars object
     */
    vars?: Record<string, any>;

    /**
     * Optional publish action
     * @param file
     * @returns the URI of the published memory
     */
    publish?: (file: string, name: string) => Promise<string>

    /**
     * The directory where to transpile the recipe ts file
     */
    transpileDir?: string;
}

export interface Commands {
    vars: () => Record<string, any>;
    tmpdir: () => string;
    exec: (cmd: string, options?: ExecOptions) => Promise<void | string>;
    from: (location: string, options?: FromOptions) => Promise<void>;
    content: (location: string, encoding?: BufferEncoding) => ContentObject | ContentObject[];
    json: (location: string) => ContentObject | ContentObject[];
    pdf: (location: string) => PdfObject | PdfObject[];
    docx: (location: string) => DocxObject | DocxObject[];
    media: (location: string, options?: MediaOptions) => MediaObject | MediaObject[];
    copy: (location: SourceSpec, path: string, options?: CopyOptions) => void;
    copyText: (text: string, path: string) => void;
}

export class Builder implements Commands {
    static instance?: Builder;

    static getInstance() {
        if (!Builder.instance) {
            throw new Error("No builder instance found");
        }
        return Builder.instance;
    }

    _vars: Record<string, any>;
    _tmpdir?: string;
    memory: MemoryPackBuilder;

    constructor(public options: BuildOptions = {}) {
        this.memory = new MemoryPackBuilder(this);
        this._vars = options.vars || {};
        Builder.instance = this;
    }

    vars(): Record<string, any> {
        return this._vars;
    }

    tmpdir() {
        if (!this._tmpdir) {
            this._tmpdir = mkdtempSync(join(os.tmpdir(), 'becomposable-memo-'));
        }
        return this._tmpdir;
    }

    from(location: string, options?: FromOptions) {
        return loadMemoryPack(location).then((memory) => {
            return this.memory.load(memory, options);
        });
    }

    addEntry(path: string, source: ContentSource) {
        this.memory.add(path, source);
    }

    copy(location: SourceSpec, path: string, options: CopyOptions = {}) {
        copy(this, location, path, options);
    }

    copyText(text: string, path: string) {
        copy(this, new TextSource(text), path);
    }

    exec(cmd: string, options?: ExecOptions) {
        return exec(cmd, options);
    }

    content(location: string, encoding?: BufferEncoding) {
        const source = AbstractContentSource.resolve(location);
        if (Array.isArray(source)) {
            return source.map(s => new ContentObject(this, s, encoding));
        } else {
            return new ContentObject(this, source, encoding);
        }
    }

    json(location: string) {
        const source = AbstractContentSource.resolve(location);
        if (Array.isArray(source)) {
            return source.map(s => new JsonObject(this, s));
        } else {
            return new JsonObject(this, source);
        }
    }

    pdf(location: string) {
        const source = AbstractContentSource.resolve(location);
        if (Array.isArray(source)) {
            return source.map(s => new PdfObject(this, s));
        } else {
            return new PdfObject(this, source);
        }
    }

    docx(location: string) {
        const source = AbstractContentSource.resolve(location);
        if (Array.isArray(source)) {
            return source.map(s => new DocxObject(this, s));
        } else {
            return new DocxObject(this, source);
        }
    }

    media(location: string, options?: MediaOptions) {
        const source = AbstractContentSource.resolve(location);
        if (Array.isArray(source)) {
            return source.map(s => new MediaObject(this, s, options));
        } else {
            return new MediaObject(this, source, options);
        }
    }

    async build(object: Record<string, any>) {
        try {
            const outputNames = this._getOutputNames();
            const publishName = outputNames.publishName;
            let fileName = outputNames.fileName;
            // resolve all content objects values from the context object
            object = await resolveContextObject(object);
            // write the memory to a file
            fileName = await this.memory.build(fileName, object);
            let target: string = fileName;
            if (publishName) {
                try {
                    target = await this.options.publish!(fileName, publishName);
                } finally {
                    rmSync(fileName);
                }
            }
            this.options.quiet || console.log(`Memory saved to ${target}`);
            return target;
        } finally {
            if (this._tmpdir) {
                rmSync(this._tmpdir, { recursive: true });
            }
        }
    }

    private _getOutputNames(): { fileName: string, publishName: string | undefined } {
        const options = this.options;
        if (!options.out) {
            options.out = "memory.tar";
        }
        let fileName: string;
        let publishName: string | undefined;
        const out = options.out;
        if (out.startsWith("memory:")) {
            if (!options.publish) {
                throw new Error(`The publish option is required for "${out}" output`);
            }
            // force gzip when publishing
            options.gzip = true;
            // create a temporary path for the output
            fileName = createTmpBaseName(this.tmpdir());
            publishName = out.substring("memory:".length);
        } else {
            fileName = resolve(out);
        }
        return { fileName, publishName };
    }

}

function resolveContextObject(object: Record<string, any>): Promise<Record<string, any>> {
    return new AsyncObjectWalker().map(object, async (_key, value) => {
        if (value instanceof ContentObject) {
            return await value.getText();
        } else {
            return value;
        }
    });
}

function createTmpBaseName(tmpdir: string) {
    return join(tmpdir, `.composable-memory-${Date.now()}.tar`);
}


export function buildMemoryPack(recipeFn: (commands: Commands) => Promise<Record<string, any>>, options: BuildOptions): Promise<string> {
    const builder = new Builder(options);
    return recipeFn({
        vars: builder.vars.bind(builder),
        tmpdir: builder.tmpdir.bind(builder),
        exec: builder.exec.bind(builder),
        from: builder.from.bind(builder),
        content: builder.content.bind(builder),
        json: builder.json.bind(builder),
        pdf: builder.pdf.bind(builder),
        docx: builder.docx.bind(builder),
        media: builder.media.bind(builder),
        copy: builder.copy.bind(builder),
        copyText: builder.copyText.bind(builder),
    }).then(metadata => builder.build(metadata));
}