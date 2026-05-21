import sharp from "sharp";

export interface TransformOptions {
    max_hw?: number,
    format?: keyof sharp.FormatEnum
}

type SharpInputType = Buffer
    | ArrayBuffer
    | Uint8Array
    | Uint8ClampedArray
    | Int8Array
    | Uint16Array
    | Int16Array
    | Uint32Array
    | Int32Array
    | Float32Array
    | Float64Array
    | string
    | NodeJS.ReadableStream

type DestroyableReadableStream = NodeJS.ReadableStream & { destroy?: () => void };
type DestroyableWritableStream = NodeJS.WritableStream & { destroy?: () => void };

function isReadableStream(input: SharpInputType): input is DestroyableReadableStream {
    return typeof (input as { pipe?: unknown }).pipe === 'function';
}

export function createImageTransformer(input: SharpInputType, opts: TransformOptions) {
    let sh: sharp.Sharp;
    if (isReadableStream(input)) {
        sh = input.pipe(sharp());
    } else {
        sh = sharp(input as Exclude<SharpInputType, NodeJS.ReadableStream>);
    }
    if (opts.max_hw) {
        sh = sh.resize({
            width: opts.max_hw,
            height: opts.max_hw,
            fit: sharp.fit.inside,
            withoutEnlargement: true,
        });
    }
    if (opts.format) {
        sh = sh.toFormat(opts.format);
    }
    return sh;
}

/**
 * @param max_hw
 * @param format
 * @returns
 */
export async function transformImage(input: SharpInputType, output: NodeJS.WritableStream, opts: TransformOptions): Promise<sharp.Sharp> {
    const sh = createImageTransformer(input, opts);
    sh.pipe(output);

    return new Promise((resolve, reject) => {
        const handleError = (err: unknown) => {
            console.error('Failed to transform', err);
            try {
                const outputStream = output as DestroyableWritableStream;
                if (isReadableStream(input)) {
                    input.destroy?.();
                }
                if (outputStream.destroy) {
                    outputStream.destroy();
                }
                sh.destroy();
            } finally {
                reject(err);
            }
        }
        output.on('error', handleError);
        if (isReadableStream(input)) {
            input.on('error', handleError);
        }
        output.on("finish", () => {
            resolve(sh);
        });
    });
}

export function transformImageToBuffer(input: SharpInputType, opts: TransformOptions): Promise<Buffer> {
    const sh = createImageTransformer(input, opts);
    return sh.toBuffer();
}

export async function transformImageToFile(input: SharpInputType, output: string, opts: TransformOptions): Promise<void> {
    const sh = createImageTransformer(input, opts);
    await sh.toFile(output);
}
