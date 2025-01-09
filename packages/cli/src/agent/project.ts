import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runDocker, runDockerWithAgentConfig } from "./docker.js";

export interface AgentConfig {
    profile?: string;
    pm?: string;
    image?: {
        repository: string;
        organization: string;
        name: string;
        version?: string;
    }
}

export interface AgentPackageJson {
    name: string;
    version: string;
    vertesia?: AgentConfig;
}

export class PackageJson implements AgentPackageJson {
    constructor(public file: string, public data: Record<string, any>) {
        if (!data.vertesia) {
            data.vertesia = {};
        }
    }

    get name() {
        return this.data.name;
    }

    set name(value: string) {
        this.data.name = value;
    }

    get version() {
        return this.data.version;
    }

    set version(value: string) {
        this.data.version = value;
    }

    get pm() {
        return this.data.vertesia.pm;
    }

    get profile() {
        return this.data.vertesia.profile;
    }

    set proffile(value: string) {
        this.data.vertesia.profile = value;
    }

    getLocalDockerTag(version: string = "latest") {
        const image = this.vertesia.image;
        if (!image || !image.organization || !image.name) {
            console.log('Agent configuration not found or not valid in package.json');
            process.exit(1);
        }
        return `${image.organization}/${image.name}:${version}`;
    }

    getVertesiaDockerTag(version: string = "latest") {
        const image = this.vertesia.image;
        if (!image || !image.repository || !image.organization || !image.name) {
            console.log('Agent configuration not found or not valid in package.json');
            process.exit(1);
        }
        const repo = image.repository.endsWith('/') ? image.repository.slice(0, -1) : image.repository;
        return `${repo}/agents/${image.organization}/${image.name}:${version}`;
    }

    get latestPublishedVersion() {
        return this.vertesia.image.version;
    }

    set latestPublishedVersion(version: string) {
        this.vertesia.image.version = version;
    }

    get vertesia() {
        return this.data.vertesia;
    }

    set vertesia(value: any) {
        this.data.vertesia = value;
    }

    save() {
        writeFileSync(this.file, JSON.stringify(this.data, undefined, 2), 'utf8');
    }
}

export class AgentProject {
    dir: string;
    packageJsonFile: string;
    _pkg?: PackageJson;

    constructor(pkgDir?: string) {
        if (!pkgDir) {
            pkgDir = process.cwd();
        }
        pkgDir = resolve(pkgDir);
        if (!existsSync(pkgDir)) {
            console.log('Directory not found:', pkgDir);
            process.exit(1);
        }
        const pkgFile = join(pkgDir, 'package.json');
        if (!existsSync(pkgFile)) {
            console.log('package.json not found at', pkgFile);
            process.exit(1);
        }
        this.dir = pkgDir;
        this.packageJsonFile = pkgFile;
    }

    get npmrcFile() {
        return join(this.dir, '.npmrc');
    }

    get dockerConfigFile() {
        return join(this.dir, 'docker.json');
    }

    get packageJson() {
        if (!this._pkg) {
            const pkgContent = readFileSync(this.packageJsonFile, 'utf8');
            this._pkg = new PackageJson(this.packageJsonFile, JSON.parse(pkgContent));
        }
        return this._pkg;
    }

    /**
     * Build the project sources using the configured package manager.
     */
    buildSources() {
        if (!this.packageJson.pm) {
            console.error('No package manager configuration found in package.json: vertesia.pm');
            process.exit(1);
        }
        spawnSync(this.packageJson.pm, ['run', 'build'], { stdio: 'inherit' });
    }

    buildDockerImage(version: string = 'latest') {
        const tag = this.packageJson.getLocalDockerTag(version);
        runDocker(['buildx', 'build', '-t', tag, '.']);
        return tag;
    }

    buildAndTagVertesiaImage(version: string) {
        const localTag = this.buildDockerImage(version);
        const vertesiaTag = this.packageJson.getVertesiaDockerTag(version);
        runDocker(['tag', localTag, vertesiaTag]);
        return vertesiaTag;
    }

    buildAndPushDockerImage(version: string) {
        const tag = this.buildAndTagVertesiaImage(version);
        this.pushDockerImage(tag);
        return tag;
    }

    pushDockerImage(tag: string) {
        runDockerWithAgentConfig(['push', tag]);
    }
}
