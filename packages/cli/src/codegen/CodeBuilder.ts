import { InteractionRefWithSchema } from "@vertesia/common";
import { join, resolve } from "path";
import { makeDir, writeFile } from "../utils/stdio.js";
import { InteractionVersion, InteractionsExportOptions } from "./InteractionVersion.js";
import { processTemplate } from "./template.js";


export class InteractionBucket {

    versions: InteractionVersion[] = [];

    constructor(public name: string) {
    }

    add(version: InteractionVersion) {
        this.versions.push(version);
        return this;
    }

    writeIndex(dir: string, opts: InteractionsExportOptions) {
        let version: InteractionVersion | undefined;
        const exportVersion = opts.exportVersion ? parseInt(opts.exportVersion) : undefined;
        if (exportVersion) {
            version = this.versions.find(version => exportVersion === version.interaction.version);
            if (!version) {
                console.error(`No export version ${exportVersion} found for interaction ${this.name}. Using default export version`);
            }
        }
        if (!version) {
            // default index export the default
            let draft: InteractionVersion | undefined;
            let latest: InteractionVersion | undefined;
            let latestFallback: InteractionVersion | undefined;
            for (const version of this.versions) {
                if (version.isDraft) {
                    draft = version;
                } else if (version.isLatest) {
                    latest = version;
                } else {
                    if (latestFallback) {
                        if (latestFallback.interaction.version < version.interaction.version) {
                            latestFallback = version;
                        }
                    } else {
                        latestFallback = version;
                    }
                }
            }
            version = latest || latestFallback || draft;
        }
        if (version) {
            const file = join(dir, 'index.ts');
            writeFile(file, processTemplate('index', {
                versionName: version.versionName
            }));
        } else {
            console.error('No default version found for interaction', this.name);
        }
    }

    build(dir: string, opts: InteractionsExportOptions) {
        console.log('Generating interaction', this.name);
        dir = join(dir, this.name);
        makeDir(dir);
        for (const version of this.versions) {
            version.build(dir, opts);
        }
        this.writeIndex(dir, opts);
    }
}

export class CodeBuilder {
    buckets: Record<string, InteractionBucket> = {};

    add(interaction: InteractionRefWithSchema) {
        const version = new InteractionVersion(interaction);
        const name = version.className;
        const bucket = this.buckets[name];
        if (bucket) {
            bucket.add(version);
        } else {
            this.buckets[name] = new InteractionBucket(name).add(version);
        }
    }

    build(interactions: InteractionRefWithSchema[], opts: InteractionsExportOptions) {
        if (interactions.length === 0) {
            console.log("Nothing to export");
            return;
        }

        const dir = resolve(opts.dir);
        // create dir if not exists
        makeDir(dir);

        for (const interaction of interactions) {
            this.add(interaction);
        }

        console.log("Generating code in", dir);
        for (const bucket of Object.values(this.buckets)) {
            bucket.build(dir, opts);
        }
    }

}