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

/** The SDK an upload session needs is not installed. */
export class UploadSessionUnavailableError extends Error {
    constructor(
        readonly packageName: string,
        cause: unknown,
    ) {
        super(`Uploading in parts needs the optional package ${packageName}`, { cause });
        this.name = 'UploadSessionUnavailableError';
    }
}
