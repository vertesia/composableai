/**
 * The browser build of `node-request.ts`, which the `browser` field of `package.json` substitutes for it, so that
 * browser bundles never resolve Node's `http`, `https` and `stream` modules. Uploads only take the Node transport
 * when {@link hasNodeHttp} is true, which it never is here.
 */
export { ContentLengthMismatchError } from './upload-runtime.js';

/**
 * False: this build has no Node transport, even in a runtime that defines `process.versions.node` (an Electron
 * renderer, or a worker with Node compatibility) and was bundled for the browser.
 */
export function hasNodeHttp(): boolean {
    return false;
}

export function nodeRequest(): never {
    throw new Error('nodeRequest is only available in Node.js');
}
