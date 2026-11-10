export class StreamSource {
    /**
     * @param size the stream's length in bytes, when it is known in advance (e.g. from a response's declared
     * length, see {@link responseBodyLength}). An upload then streams the content with that `Content-Length`
     * instead of buffering it, and fails if the stream ends short of it or runs past it.
     */
    constructor(
        public stream: ReadableStream,
        public name: string,
        public type?: string,
        public id?: string,
        public size?: number,
    ) {}

    /**
     * The same content as a `Blob` that can be sent more than once without being held in memory, such as a
     * blob backed by a local file. Uploads send it instead of {@link stream} when there is one, so a failed
     * transfer can be retried. A plain stream source has none.
     */
    replayableBody(): Promise<Blob | undefined> {
        return Promise.resolve(undefined);
    }
}

/**
 * The length of a response body as it will be read, from its `Content-Length`: undefined when the header is
 * missing or invalid, or when the body is content-encoded, since `fetch` decodes it and the bytes read then differ
 * from the declared length.
 */
export function responseBodyLength(response: Response): number | undefined {
    const encoding = response.headers.get('content-encoding')?.trim().toLowerCase();
    if (encoding && encoding !== 'identity') return undefined;
    const header = response.headers.get('content-length');
    if (header === null || !/^\d+$/.test(header.trim())) return undefined;
    const length = Number(header.trim());
    return Number.isSafeInteger(length) ? length : undefined;
}
