import type { XMLParser } from 'fast-xml-parser';
import formidable from 'formidable';
import inflate from 'inflation';
import type Koa from 'koa';
import type { Context, Request } from 'koa';
import qs from 'qs';
import readRawBody, { type Options as RawBodyOptions } from 'raw-body';

declare module 'koa' {
    interface BaseContext {
        payload: Promise<LazyBody>;
        hasPayload: boolean;
        /** Per-request override applied before the lazy body is first read. */
        requestBodyLimit?: RawBodyOptions['limit'];
    }
}

export interface OwnOpts {
    formidable?: formidable.Options;
    inflate?: inflate.Options;
    // biome-ignore lint/suspicious/noExplicitAny: custom parser returns user-defined shape
    form?: (data: string) => any;
    // biome-ignore lint/suspicious/noExplicitAny: custom parser returns user-defined shape
    json?: (data: string) => any;
    // biome-ignore lint/suspicious/noExplicitAny: custom parser returns user-defined shape
    xml?: (data: string) => any;
}
export type LazyBodyOpts = RawBodyOptions & OwnOpts;

function parseMultipartBody(
    koaRequest: Request,
    opts: LazyBodyOpts,
): Promise<{
    params: formidable.Fields;
    files: formidable.Files;
}> {
    const form = formidable(opts.formidable);
    return new Promise((resolve, reject) => {
        form.parse(koaRequest.req, (err, fields, files) => {
            if (err) {
                reject(withClientStatus(err));
            } else {
                resolve({
                    params: fields,
                    files: files,
                });
            }
        });
    });
}

/**
 * Give a formidable error its HTTP status. formidable tags the caller's mistakes with a 4xx `httpCode`
 * (a multipart content type without a boundary is 400, a body over the size limits 413), which Koa
 * ignores: it reads `status`, so without this they answer 500.
 */
function withClientStatus(err: unknown): unknown {
    const httpCode = (err as { httpCode?: unknown } | null)?.httpCode;
    if (err instanceof Error && typeof httpCode === 'number' && httpCode >= 400 && httpCode < 500) {
        Object.assign(err, { status: httpCode, statusCode: httpCode, expose: true });
    }
    return err;
}

async function getRawBodyText(koaRequest: Request, opts: LazyBodyOpts): Promise<string> {
    // raw-body options are request-specific. In particular, `length` must never leak from one
    // request to the next when a later request is compressed or uses chunked transfer encoding.
    const requestOpts = { ...opts };
    if (koaRequest.ctx.requestBodyLimit !== undefined) {
        requestOpts.limit = koaRequest.ctx.requestBodyLimit;
    }
    const len = koaRequest.length;
    const encoding = koaRequest.headers['content-encoding'];
    if (len && !encoding) {
        requestOpts.length = len;
    } else {
        delete requestOpts.length;
    }
    try {
        // TODO how to detect custom encoding on content type to ser encoding for readRawBody
        return (await readRawBody(inflate(koaRequest.req, requestOpts.inflate), requestOpts)).toString();
    } catch (err: unknown) {
        // A client that hung up before the body was read leaves a destroyed request behind, which
        // raw-body reports as a 500 "stream is not readable". Nothing failed on the server, and no
        // response can reach the client: answer 499 (client closed request) so it counts as a 4xx.
        // Only that error: a body rejected for its size or encoding keeps its 413/415 even if the
        // connection closed too.
        if (koaRequest.req.destroyed && isRawBodyError(err, 'stream.not.readable')) {
            throw Object.assign(new Error('Client closed the request before its body was read', { cause: err }), {
                status: CLIENT_CLOSED_REQUEST,
                statusCode: CLIENT_CLOSED_REQUEST,
                expose: true,
            });
        }
        throw err;
    }
}

/** Not in the HTTP spec; the status proxies such as nginx log for a client that disconnected. */
const CLIENT_CLOSED_REQUEST = 499;

function isRawBodyError(err: unknown, type: string): err is Error {
    return err instanceof Error && (err as Error & { type?: unknown }).type === type;
}

/**
 * Request body class
 * json
 *
 */
export class LazyBody {
    ctx: Context;
    type: FormType;
    // biome-ignore lint/suspicious/noExplicitAny: parsed HTTP body — caller types per route
    data: any;
    raw: string;
    files: formidable.Files | null | undefined;

    constructor(
        ctx: Context,
        type: FormType,
        // biome-ignore lint/suspicious/noExplicitAny: parsed HTTP body — caller types per route
        data: any,
        raw: string,
        files: formidable.Files | null | undefined,
    ) {
        this.ctx = ctx;
        this.type = type;
        this.data = data;
        this.raw = raw;
        this.files = files;
    }

    get isEmpty() {
        return this.raw === '';
    }

    assertJSON(statusCode: number, message: string) {
        if (this.type !== FormType.json) {
            this.ctx.throw(statusCode || 415, message);
        }
    }

    assertXML(statusCode: number, message: string) {
        if (this.type !== FormType.xml) {
            this.ctx.throw(statusCode || 415, message);
        }
    }

    /**
     * Assert body type is urlencoded
     * @param {*} statusCode
     * @param {*} message
     */
    assertForm(statusCode: number, message: string) {
        if (this.type !== FormType.form) {
            this.ctx.throw(statusCode || 415, message);
        }
    }

    assertMultipart(statusCode: number, message: string) {
        if (this.type !== FormType.multipart) {
            this.ctx.throw(statusCode || 415, message);
        }
    }

    assertText(statusCode: number, message: string) {
        if (this.type !== FormType.text) {
            this.ctx.throw(statusCode || 415, message);
        }
    }

    /**
     * Assert that body type is either multipart or urlencoded
     * @param {*} statusCode
     * @param {*} message
     */
    assertParams(statusCode: number, message: string) {
        if (this.type !== FormType.form && this.type !== FormType.multipart) {
            this.ctx.throw(statusCode || 415, message);
        }
    }

    get text() {
        return this.raw;
    }

    get json() {
        return this.isJSON ? this.data : undefined;
    }

    get xml() {
        return this.isXML ? this.data : undefined;
    }

    get params() {
        switch (this.type) {
            case FormType.form:
            case FormType.multipart:
                return this.data;
            default:
                return undefined;
        }
    }

    get isForm() {
        return this.type === FormType.form;
    }

    get isJSON() {
        return this.type === FormType.json;
    }

    get isXML() {
        return this.type === FormType.xml;
    }

    get isMultipart() {
        return this.type === FormType.multipart;
    }

    get isText() {
        return this.type === FormType.text;
    }

    static install(koa: Koa, opts: LazyBodyOpts = {}): void {
        opts.encoding = opts.encoding || 'utf8';
        opts.limit = opts.limit || '1mb';
        Object.defineProperty(koa.request, 'body', {
            get() {
                if (!this._body) {
                    this._body = createBody(this, opts);
                }
                return this._body;
            },
            // be able to work along code using koa2-formidable (wich sets the body property pf the request)
            set(body) {
                this._body = body;
            },
        });
        // payload is an alias to request.body
        Object.defineProperty(koa.context, 'payload', {
            get() {
                return this.request.body;
            },
            set(body) {
                this.request.body = body;
            },
        });
        // payload is an alias to request.hasBody in v3
        Object.defineProperty(koa.context, 'hasPayload', {
            get() {
                return this.request.length > 0 || this.request.headers['transfer-encoding'] != null;
            },
        });
    }
}
enum FormType {
    multipart,
    form,
    json,
    xml,
    text,
}

async function createBody(koaRequest: Request, opts: LazyBodyOpts) {
    let type: FormType,
        // biome-ignore lint/suspicious/noExplicitAny: parsed HTTP body — caller types per route
        data: any,
        raw: string,
        files: formidable.Files | null | undefined = null;
    if (koaRequest.is('multipart')) {
        raw = '';
        const result = await parseMultipartBody(koaRequest, opts);
        data = result.params || {};
        files = result.files || {};
        type = FormType.multipart;
    } else if (koaRequest.is('urlencoded')) {
        // by default we use qs. You can replace the querystring parser using opts.form
        raw = await getRawBodyText(koaRequest, opts);
        data = parseBody(koaRequest, 'form', () => (opts.form ? opts.form(raw) : qs.parse(raw)));
        type = FormType.form;
    } else if (koaRequest.is('json', '+json')) {
        // by default we use JSON.parse. You can replace the json parser using opts.json
        if (koaRequest.ctx.hasPayload) {
            raw = await getRawBodyText(koaRequest, opts);
        } else {
            raw = '';
        }
        if (raw === '') {
            // for JSON we support no content posted
            data = undefined;
        } else {
            data = parseBody(koaRequest, 'JSON', () => (opts.json ? opts.json(raw) : JSON.parse(raw)));
        }
        type = FormType.json;
    } else if (koaRequest.is('xml', '+xml')) {
        // by default fast-xml-parser is used - to change the parser you should provde an xml parser through opts.xml
        raw = await getRawBodyText(koaRequest, opts);
        if (opts.xml) {
            const parseXml = opts.xml;
            data = parseBody(koaRequest, 'XML', () => parseXml(raw));
        } else {
            const parser = await tryGetXmlParser();
            if (parser) {
                data = parseBody(koaRequest, 'XML', () => parser.parse(raw));
            }
        }
        type = FormType.xml;
    } else if (koaRequest.is('text/*')) {
        raw = await getRawBodyText(koaRequest, opts);
        type = FormType.text;
    } else {
        type = FormType.text;
        // if has body
        console.log();
        if (koaRequest.ctx.hasPayload) {
            raw = await getRawBodyText(koaRequest, opts);
        } else {
            raw = '';
        }
    }
    return new LazyBody(koaRequest.ctx, type, data, raw, files);
}

/**
 * Run a body parser. A body the parser rejects is the client's fault, so it answers 400 with the
 * parser's reason rather than letting a `SyntaxError` surface as a 500. An error that already carries
 * an HTTP status (thrown by a custom parser) keeps it.
 */
function parseBody<T>(koaRequest: Request, format: string, parse: () => T): T {
    try {
        return parse();
    } catch (err: unknown) {
        if (err !== null && typeof err === 'object' && ('status' in err || 'statusCode' in err)) {
            throw err;
        }
        const reason = err instanceof Error ? err.message : String(err);
        return koaRequest.ctx.throw(400, `Invalid ${format} request body: ${reason}`, { cause: err });
    }
}

/**
 * Use fast-xml-parser if available
 * @returns
 */
async function tryGetXmlParser(): Promise<XMLParser | undefined> {
    try {
        const mod = (await import('fast-xml-parser')) as typeof import('fast-xml-parser');
        return new mod.XMLParser();
    } catch (err) {
        console.warn('Could not find fast-xml-parser. You need to pass xml option for a custom parser', err);
        return undefined;
    }
}
