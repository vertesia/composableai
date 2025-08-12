import { basename, dirname, extname, join } from "path";

/**
 * The path argument is the empty string when mapping streams or buffers not related to a file system file.
 */
export type PathMapperFn = ((path: string, index: number) => string);

export function createPathRewrite(path: string): PathMapperFn {
    let truncPath: (path: string) => string;
    let basePath: string = '';
    let index = path.indexOf('!');
    if (index > -1) {
        basePath = path.substring(0, index);
        if (!basePath.endsWith('/')) {
            basePath += '/';
        }
        truncPath = (path: string) => {
            return path.substring(basePath.length);
        }
        path = path.substring(index + 1);
    } else {
        truncPath = (path: string) => {
            return basename(path);
        }
    }
    if (path === '*') {
        // preserve path
        return truncPath;
    } else if (path.endsWith("/*")) {
        const prefix = path.slice(0, -2);
        return (path: string) => {
            path = truncPath(path);
            return join(prefix, path);
        }
    } else {
        // use path builder
        return buildPathRewrite(path, truncPath);
    }
}

const RX_PARTS = /(%d\/)|(\.?%e)|(%[fnip])/g;
function buildPathRewrite(path: string, truncPath: (path: string) => string): PathMapperFn {
    let parts: ((path: Path, index: number) => string)[] = [];
    let m: RegExpExecArray | null;
    let lastIndex = 0;
    while (m = RX_PARTS.exec(path)) {
        if (m.index > lastIndex) {
            const literal = path.substring(lastIndex, m.index);
            parts.push(() => literal);
        }
        if (m[1]) { // %d/
            parts.push((path: Path) => path.dirname ? path.dirname + '/' : '');
        } else if (m[2]) { // .?%e
            if (m[2][0] === '.') {
                parts.push((path: Path) => path.extname || '');
            } else {
                parts.push((path: Path) => path.extname ? path.extname.slice(1) : ''); // extension without dot
            }
        } else if (m[3]) {
            switch (m[3]) {
                case '%f':
                    parts.push((path: Path) => path.name);
                    break;
                case '%n':
                    parts.push((path: Path) => path.basename);
                    break;
                case '%p': // stringify the path by replacing / with _
                    parts.push((path: Path) => {
                        let p = path.value;
                        if (p.startsWith('/')) {
                            p = p.substring(1);
                        }
                        return p.replaceAll('/', '_');
                    });
                    break;
                case '%i': // index
                    parts.push((_path: Path, index: number) => String(index));
                    break;
                default: throw new Error(`Bug: should never happen`);
            }
        }
        lastIndex = m.index + m[0].length;
    }
    if (!parts.length) {
        return () => path;
    } else {
        if (lastIndex < path.length) {
            const literal = path.substring(lastIndex);
            parts.push(() => literal);
        }
        return (path: string, index: number) => {
            const pathObj = new Path(truncPath(path));
            const out = [];
            for (const part of parts) {
                out.push(part(pathObj, index));
            }
            return out.join('');
        }
    }
}


export class Path {
    _name?: string;
    _extname?: string;
    _dirname?: string;
    _basename?: string;

    /**
     * The complete path value
     */
    value: string

    /**
     * The file name (the last portion of the path). Includes the extension if present.
     */
    get name(): string {
        if (!this._name) {
            this._name = basename(this.value);
        }
        return this._name;
    }

    /**
     * The extension of the file  including the leading '.'.
     * An empty string if the file has no extension.
     */
    get extname(): string {
        if (!this._extname) {
            this._extname = extname(this.value);
        }
        return this._extname;
    }
    /**
     * The directory portion of the path. Doesn't include the trailing slash.
     * If no directory is present, returns an empty string.
     */
    get dirname(): string {
        if (!this._dirname) {
            this._dirname = dirname(this.value);
            if (this._dirname === '.') {
                this._dirname = '';
            }
        }
        return this._dirname;
    }
    /**
     * The path without the extension
     */
    get basename(): string {
        if (!this._basename) {
            this._basename = this.extname ? this.name.slice(0, -this.extname.length) : this.name;
        }
        return this._basename;
    }

    constructor(value: string) {
        this.value = value;
    }

    /**
     * Return the complete path value (same as `value`)
     */
    toString(): string {
        return this.value;
    }
}
