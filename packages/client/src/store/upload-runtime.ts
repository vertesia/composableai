/** Runtime checks and errors of the upload transports, safe to load in any runtime. */

/** Whether this runtime has Node's `http` client (Node.js, and runtimes compatible with it such as Bun). */
export function hasNodeHttp(): boolean {
    return typeof process !== 'undefined' && typeof process.versions?.node === 'string';
}

/** The error for a body whose size differs from its declared `Content-Length`. */
export class ContentLengthMismatchError extends Error {
    constructor(
        readonly declared: number,
        readonly actual: number,
        readonly direction: 'short' | 'long',
    ) {
        super(
            direction === 'short'
                ? `Upload body ended after ${actual} bytes, short of its declared length of ${declared}`
                : `Upload body ran past its declared length of ${declared} bytes`,
        );
        this.name = 'ContentLengthMismatchError';
    }
}

/** The `Content-Length` in `headers`, in any letter case; undefined when absent or not a whole byte count. */
export function contentLengthHeader(headers: Record<string, string> | undefined): number | undefined {
    const entry = Object.entries(headers ?? {}).find(([name]) => name.toLowerCase() === 'content-length');
    if (!entry || !/^\d+$/.test(entry[1].trim())) return undefined;
    const length = Number(entry[1].trim());
    return Number.isSafeInteger(length) ? length : undefined;
}
