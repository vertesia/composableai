export class Version {
    constructor(public major: number, public minor: number, public patch: number) {
    }

    toString() {
        return `${this.major}.${this.minor}.${this.patch}`;
    }

    nextMinor() {
        return new Version(this.major, this.minor + 1, 0);
    }

    nextMajor() {
        return new Version(this.major + 1, 0, 0);
    }

    nextPatch() {
        return new Version(this.major, this.minor, this.patch + 1);
    }

    static parse(version: string) {
        const [major, minor, patch] = version.split('.').map(v => parseInt(v) ?? 0);
        return new Version(major, minor, patch);

    }
}