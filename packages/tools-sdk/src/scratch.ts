/**
 * Per-invocation scratch storage with one API in every host. Under the Vertesia workerd sandbox it is served
 * by the runtime; on Node (localhost, Vercel) it lives in memory for the request. Either way it is private to
 * one tool request and gone when the request ends: keep durable results in agent artifacts or files.
 *
 * Browser-safe: no Node built-ins, so the sandbox bundle can include it.
 */

export type ScratchData = string | Uint8Array | ArrayBuffer | Blob;

export interface ScratchEntry {
    key: string;
    size: number;
    contentType: string;
}

export interface ToolScratch {
    /** Create or replace `key`. Keys are `/`-separated relative paths, e.g. `work/page-1.json`. */
    put(key: string, data: ScratchData, options?: { contentType?: string }): Promise<void>;
    putJson(key: string, value: unknown): Promise<void>;
    /** `undefined` when the key does not exist. */
    get(key: string): Promise<Uint8Array | undefined>;
    getText(key: string): Promise<string | undefined>;
    getJson<T = unknown>(key: string): Promise<T | undefined>;
    /** `false` when the key did not exist. */
    delete(key: string): Promise<boolean>;
    list(): Promise<ScratchEntry[]>;
}

export type ScratchErrorCode = 'invalid_key' | 'quota_exceeded' | 'unavailable';

export class ScratchError extends Error {
    constructor(
        public readonly code: ScratchErrorCode,
        message: string,
        options?: { cause?: unknown },
    ) {
        super(message, options);
        this.name = 'ScratchError';
    }
}

/** Matches the sandbox runtime's per-invocation default (`APP_RUNTIME_MAX_SCRATCH_BYTES`). */
export const DEFAULT_SCRATCH_QUOTA_BYTES = 128 * 1024 * 1024;

/** Guest-visible origin of the sandbox runtime's scratch storage. */
export const SANDBOX_SCRATCH_ORIGIN = 'http://scratch.invalid';

export function validateScratchKey(key: string): void {
    if (
        typeof key !== 'string' ||
        !key ||
        key.length > 1024 ||
        /[\\\0]/.test(key) ||
        key.split('/').some((part) => part === '.' || part === '..' || !part)
    )
        throw new ScratchError('invalid_key', `Invalid scratch key: ${JSON.stringify(key)}`);
}

/** Always a private copy: later caller mutations cannot change stored content in either backend. */
async function toBytes(data: ScratchData): Promise<Uint8Array<ArrayBuffer>> {
    if (typeof data === 'string') return new TextEncoder().encode(data);
    if (data instanceof Uint8Array) return data.slice();
    if (data instanceof ArrayBuffer) return new Uint8Array(data.slice(0));
    return new Uint8Array(await data.arrayBuffer());
}

function contentTypeOf(data: ScratchData, contentType: string | undefined): string {
    if (contentType) return contentType;
    if (typeof data === 'string') return 'text/plain;charset=UTF-8';
    if (typeof Blob !== 'undefined' && data instanceof Blob && data.type) return data.type;
    return 'application/octet-stream';
}

/** Shared convenience methods over the three primitives each backend implements. */
function withHelpers(base: {
    put(key: string, bytes: Uint8Array<ArrayBuffer>, contentType: string): Promise<void>;
    get(key: string): Promise<Uint8Array | undefined>;
    delete(key: string): Promise<boolean>;
    list(): Promise<ScratchEntry[]>;
}): ToolScratch {
    const scratch: ToolScratch = {
        async put(key, data, options) {
            validateScratchKey(key);
            await base.put(key, await toBytes(data), contentTypeOf(data, options?.contentType));
        },
        putJson: (key, value) => scratch.put(key, JSON.stringify(value), { contentType: 'application/json' }),
        async get(key) {
            validateScratchKey(key);
            return base.get(key);
        },
        async getText(key) {
            const bytes = await scratch.get(key);
            return bytes === undefined ? undefined : new TextDecoder().decode(bytes);
        },
        async getJson<T>(key: string) {
            const text = await scratch.getText(key);
            return text === undefined ? undefined : (JSON.parse(text) as T);
        },
        async delete(key) {
            validateScratchKey(key);
            return base.delete(key);
        },
        list: () => base.list(),
    };
    return scratch;
}

/** In-process scratch for Node hosts. One instance per request; it is garbage collected with the request. */
export function createMemoryScratch(quota = defaultMemoryQuota()): ToolScratch {
    const entries = new Map<string, { bytes: Uint8Array; contentType: string }>();
    let used = 0;
    return withHelpers({
        async put(key, bytes, contentType) {
            const previous = entries.get(key)?.bytes.byteLength ?? 0;
            if (bytes.byteLength > quota - used + previous)
                throw new ScratchError('quota_exceeded', `Scratch storage quota of ${quota} bytes exceeded`);
            entries.set(key, { bytes, contentType });
            used += bytes.byteLength - previous;
        },
        async get(key) {
            return entries.get(key)?.bytes.slice();
        },
        async delete(key) {
            const entry = entries.get(key);
            if (!entry) return false;
            entries.delete(key);
            used -= entry.bytes.byteLength;
            return true;
        },
        async list() {
            return [...entries].map(([key, { bytes, contentType }]) => ({ key, size: bytes.byteLength, contentType }));
        },
    });
}

function defaultMemoryQuota(): number {
    const configured = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
        ?.VERTESIA_SCRATCH_MAX_BYTES;
    const value = configured === undefined ? DEFAULT_SCRATCH_QUOTA_BYTES : Number(configured);
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid VERTESIA_SCRATCH_MAX_BYTES');
    return value;
}

/** Scratch served by the Vertesia sandbox runtime; the runtime enforces the quota. */
export function createSandboxScratch(fetchImpl: typeof fetch = (...args) => fetch(...args)): ToolScratch {
    const url = (key = '') => `${SANDBOX_SCRATCH_ORIGIN}/${key.split('/').map(encodeURIComponent).join('/')}`;
    const failure = async (response: Response, operation: string) => {
        const detail = (await response.text().catch(() => '')).slice(0, 200);
        if (response.status === 507)
            return new ScratchError('quota_exceeded', detail || 'Scratch storage quota exceeded');
        if (response.status === 400) return new ScratchError('invalid_key', detail || 'Invalid scratch key');
        return new ScratchError('unavailable', `Scratch ${operation} failed with status ${response.status}: ${detail}`);
    };
    return withHelpers({
        async put(key, bytes, contentType) {
            const response = await fetchImpl(url(key), {
                method: 'PUT',
                headers: { 'content-type': contentType },
                body: bytes,
            });
            if (!response.ok) throw await failure(response, 'write');
        },
        async get(key) {
            const response = await fetchImpl(url(key));
            if (response.status === 404) return undefined;
            if (!response.ok) throw await failure(response, 'read');
            return new Uint8Array(await response.arrayBuffer());
        },
        async delete(key) {
            const response = await fetchImpl(url(key), { method: 'DELETE' });
            if (response.status === 404) return false;
            if (!response.ok) throw await failure(response, 'delete');
            return true;
        },
        async list() {
            const response = await fetchImpl(url());
            if (!response.ok) throw await failure(response, 'list');
            const body = (await response.json()) as { entries: { key: string; size: number; type: string }[] };
            return body.entries.map(({ key, size, type }) => ({ key, size, contentType: type }));
        },
    });
}
