/**
 * The browser build of `node-request.ts`, which the `browser` field of `package.json` substitutes for it, so that
 * browser bundles never resolve Node's `http`, `https` and `stream` modules. Uploads only take the Node transport
 * when {@link hasNodeHttp} is true, which it never is in a browser.
 */
export { ContentLengthMismatchError, hasNodeHttp } from './upload-runtime.js';

export function nodeRequest(): never {
    throw new Error('nodeRequest is only available in Node.js');
}

export function exactLength(): never {
    throw new Error('exactLength is only available in Node.js');
}
