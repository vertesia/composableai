import type { XMLParser } from 'fast-xml-parser';
import formidable from 'formidable';
import inflate from 'inflation';
import type Koa from 'koa';
import type { Context, Request } from 'koa';
import qs from 'qs';
import readRawBody from 'raw-body';

declare module 'koa' {
    interface BaseContext {
        payload: Promise<LazyBody>;
        hasPayload: boolean;
    }
}

export interface OwnOpts {
    formidable?: formidable.Options;
    inflate?: inflate.Options;
    form?: (data: string) => any;
    json?: (data: string) => any;
    xml?: (data: string) => any;
}
export type LazyBodyOpts = readRawBody.Options & OwnOpts;

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
                reject(err);
            } else {
                resolve({
                    params: fields,
                    files: files,
                });
            }
        });
    });
}

async function getRawBodyText(koaRequest: Request, opts: LazyBodyOpts): Promise<string> {
    const len = koaRequest.length;
    const encoding = koaRequest.headers['content-encoding'];
    if (len && !encoding) {
        opts.length = len;
    }
    // TODO how to detect custom encoding on content type to ser encoding for readRawBody
    return (await readRawBody(inflate(koaRequest.req, opts.inflate), opts)).toString(/*which charset?*/);
}

/**
 * Request body class
 * json
 *
 */
export class LazyBody {
    ctx: Context;
    type: FormType;
    data: any;
    raw: string;
    files: formidable.Files | null | undefined;

    constructor(ctx: Context, type: FormType, data: any, raw: string, files: formidable.Files | null | undefined) {
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
        data = opts.form ? opts.form(raw) : qs.parse(raw);
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
            data = opts.json ? opts.json(raw) : JSON.parse(raw);
        }
        type = FormType.json;
    } else if (koaRequest.is('xml', '+xml')) {
        // by default fast-xml-parser is used - to change the parser you should provde an xml parser through opts.xml
        raw = await getRawBodyText(koaRequest, opts);
        if (opts.xml) {
            data = opts.xml(raw);
        } else {
            const parser = await tryGetXmlParser();
            if (parser) {
                data = parser.parse(raw);
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
