import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export interface WorkerConfig {
    profile?: string;
    pm?: string;
    image?: {
        repository: string;
        organization: string;
        name: string;
        version?: string;
    };
}

export interface WorkerPackageJson {
    name: string;
    version: string;
    vertesia?: WorkerConfig;
}

export class PackageJson implements WorkerPackageJson {
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

    set profile(value: string) {
        this.data.vertesia.profile = value;
    }

    getWorkerId() {
        const image = this.vertesia.image;
        if (!image || !image.organization || !image.name) {
            console.log("Worker configuration not found or not valid in package.json");
            process.exit(1);
        }
        return `${image.organization}/${image.name}`;
    }

    getLocalDockerTag(version: string) {
        return `${this.getWorkerId()}:${version}`;
    }

    getVertesiaDockerTag(version: string) {
        const workerId = this.getWorkerId();
        let repo = this.vertesia.image.repository;
        if (repo.endsWith("/")) {
            repo = repo.slice(0, -1);
        }
        return `${repo}/workers/${workerId}:${version}`;
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
        writeFileSync(this.file, JSON.stringify(this.data, undefined, 2), "utf8");
    }
}

export class WorkerProject {
    dir: string;
    packageJsonFile: string;
    _pkg?: PackageJson;

    constructor(pkgDir?: string) {
        const resolvedDir = resolve(pkgDir || process.cwd());
        if (!existsSync(resolvedDir)) {
            console.log("Directory not found:", resolvedDir);
            process.exit(1);
        }
        const pkgFile = join(resolvedDir, "package.json");
        if (!existsSync(pkgFile)) {
            console.log("package.json not found at", pkgFile);
            process.exit(1);
        }
        this.dir = resolvedDir;
        this.packageJsonFile = pkgFile;
    }

    get npmrcFile() {
        return join(this.dir, ".npmrc");
    }

    get dockerConfigFile() {
        return join(this.dir, "docker.json");
    }

    get packageJson() {
        if (!this._pkg) {
            const pkgContent = readFileSync(this.packageJsonFile, "utf8");
            this._pkg = new PackageJson(this.packageJsonFile, JSON.parse(pkgContent));
        }
        return this._pkg;
    }

    getWorkerId() {
        return this.packageJson.getWorkerId();
    }

    getVertesiaDockerTag(version: string) {
        return this.packageJson.getVertesiaDockerTag(version);
    }

    getLocalDockerTag(version: string) {
        return this.packageJson.getLocalDockerTag(version);
    }

    buildSources() {
        if (!this.packageJson.pm) {
            console.error("No package manager configuration found in package.json: vertesia.pm");
            process.exit(1);
        }
        spawnSync(this.packageJson.pm, ["run", "build"], { stdio: "inherit" });
    }
}
