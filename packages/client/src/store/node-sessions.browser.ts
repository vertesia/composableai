/**
 * The browser build of `node-sessions.ts`, which the `browser` field of `package.json` substitutes for it, so that
 * browser bundles never resolve the storage SDKs. Uploads only open a session when `hasNodeHttp()` is true, which it
 * never is in a browser.
 */
function nodeOnly(): never {
    throw new Error('Uploading in parts is only available in Node.js');
}

export function uploadGcsResumable(): never {
    return nodeOnly();
}

export function uploadAzureBlocks(): never {
    return nodeOnly();
}
