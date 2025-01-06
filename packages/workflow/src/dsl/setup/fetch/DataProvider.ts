import { FindPayload } from "@vertesia/common";

function parseSelector(selector: string) {
    const parts = selector.split(/\s+/);
    const result: Record<string, number> = {};
    for (const part of parts) {
        if (part.startsWith("-")) {
            result[part.substring(1)] = 0;
        } else {
            result[part] = 1;
        }
    }
    return result;
}

function applyProjection(result: Record<string, any>, select: string) {
    if (!result) return result;
    let selectorObj: Record<string, number | boolean>;
    if (typeof select === 'string') {
        selectorObj = parseSelector(select);
    } else {
        selectorObj = select;
    }

    const out: Record<string, any> = {};
    for (const key of Object.keys(result)) {
        if (selectorObj[key]) {
            out[key] = result[key];
        }
    }
    return out;
}

export abstract class DataProvider {
    constructor(public name: string, public isProjectionSupported = false) {
    }
    async fetch(payload: FindPayload) {
        let results = await this.doFetch(payload);
        if (payload.select && !this.isProjectionSupported) {
            results = results.map((result: Record<string, any>) => applyProjection(result, payload.select!));
        }
        return results;
    }
    abstract doFetch(payload: FindPayload): Promise<Record<string, any>[]>;
}
