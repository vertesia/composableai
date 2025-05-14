import fs from "fs";

interface PackageJson {
    name: string;
    version: string;
    description: string;
    type: string;
    types: string;
    main: string;
    files?: string[];
    module?: string;
    license?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
    bin?: Record<string, string>,
    plugin?: {
        title?: string;
        icon?: string;
        publisher?: string;
        external?: boolean;
    };
}


export class Package {
    constructor(public data: PackageJson, public file?: string) {
    }
    static fromFile(file: string) {
        const content = fs.readFileSync(file, "utf8");
        return new Package(JSON.parse(content), file);
    }

    get name() {
        return this.data.name;
    }

    set name(name: string) {
        this.data.name = name;
    }

    get version() {
        return this.data.version;
    }

    set version(version: string) {
        this.data.version = version;
    }

    get description() {
        return this.data.description;
    }

    set description(description: string) {
        this.data.description = description;
    }

    get scripts() {
        if (!this.data.scripts) this.data.scripts = {};
        return this.data.scripts;
    }

    set scripts(scripts: Record<string, string>) {
        this.data.scripts = scripts;
    }

    save() {
        if (!this.file) throw new Error("File not specified, Use saveTo")
        fs.writeFileSync(this.file, JSON.stringify(this.data, undefined, 2), "utf8");

    }

    saveTo(file: string) {
        this.file = file;
        this.save();
    }

    toJson(): PackageJson {
        return { ...this.data };
    }
}