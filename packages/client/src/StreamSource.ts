export class StreamSource {
    constructor(
        public stream: ReadableStream,
        public name: string,
        public type?: string,
        public id?: string,
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
