export class StreamSource {
    constructor(
        public stream: ReadableStream,
        public name: string,
        public type?: string,
        public id?: string,
    ) {}
}
