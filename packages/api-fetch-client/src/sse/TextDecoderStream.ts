/**
 * Decode a stream of bytes into a stream of characters.
 * Some javascript env like Bun.js doesn't supports the TextDecoderStream (as for jan 2024)
 * This is a polyfill for bunJS
 */
let _TextDecoderStream: typeof TextDecoderStream;
if (globalThis.TextDecoderStream && typeof globalThis.TextDecoderStream === 'function') {
    _TextDecoderStream = globalThis.TextDecoderStream;
} else {
    class MyTextDecoderStream extends TransformStream<ArrayBuffer | Uint8Array, string> {
        private _options: {
            encoding: string,
            fatal?: boolean,
            ignoreBOM?: boolean
        }
        constructor(encoding = "utf-8", { fatal = false, ignoreBOM = false }: {
            fatal?: boolean,
            ignoreBOM?: boolean
        } = {}) {
            super(new TextDecodeTransformer(new TextDecoder(encoding, { fatal, ignoreBOM })));
            this._options = { fatal, ignoreBOM, encoding };
        }

        get encoding() {
            return this._options.encoding;
        }
        get fatal() {
            return this._options.fatal;
        }
        get ignoreBOM() {
            return this._options.ignoreBOM;
        }
    }
    class TextDecodeTransformer implements Transformer<ArrayBuffer | Uint8Array, string> {
        private decoder: TextDecoder;

        constructor(decoder: TextDecoder) {
            this.decoder = decoder;
        }

        transform(chunk: ArrayBuffer | Uint8Array, controller: TransformStreamDefaultController<string>) {
            if (!(chunk instanceof ArrayBuffer || ArrayBuffer.isView(chunk))) {
                throw new TypeError("Input must be a compatible with: ArrayBuffer | Uint8Array");
            }
            const text = this.decoder.decode(chunk, { stream: true });
            if (text.length !== 0) {
                controller.enqueue(text);
            }
        }

        flush(controller: TransformStreamDefaultController<string>) {
            const text = this.decoder.decode();
            if (text.length !== 0) {
                controller.enqueue(text);
            }
        }
    }
    _TextDecoderStream = MyTextDecoderStream as any;
}

export { _TextDecoderStream as TextDecoderStream };

