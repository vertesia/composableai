import fs from 'node:fs';
import path from 'node:path';

let prlimitPath: string | null | undefined;

/**
 * The path of util-linux `prlimit`, which runs a command under resource limits, or undefined where it is not available
 * (any system but Linux, or a Linux without it). Looked up once, on the PATH.
 */
export function findPrlimit(): string | undefined {
    if (prlimitPath === undefined) {
        prlimitPath = process.platform === 'linux' ? lookUp('prlimit') : null;
    }
    return prlimitPath ?? undefined;
}

function lookUp(command: string): string | null {
    for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
        if (!dir) {
            continue;
        }
        const candidate = path.join(dir, command);
        try {
            fs.accessSync(candidate, fs.constants.X_OK);
            return candidate;
        } catch {
            // Not in this directory.
        }
    }
    return null;
}
