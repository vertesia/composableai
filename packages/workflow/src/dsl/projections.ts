import type { DSLActivityExecutionPayload } from "@vertesia/common";
import { matchCondition } from "./conditions.js";
import { Vars } from "./vars.js";


type ProjectOperation = (arg: unknown, vars: Vars) => unknown

interface ElementOperation {
    field?: string,
    from: unknown[],
    where: Record<string, unknown>,
    else: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: object): Record<string, unknown> {
    return value as Record<string, unknown>;
}

function isElementOperation(value: unknown): value is ElementOperation {
    return isRecord(value) && Array.isArray(value.from) && isRecord(value.where);
}

const operations: Record<string, ProjectOperation> = {
    $element(arg: unknown, _vars: Vars) {
        if (!isElementOperation(arg)) {
            return undefined;
        }
        const where = arg.where;
        const whereKeys = Object.keys(where);
        const r = arg.from.find((elem: unknown) => {
            for (const key of whereKeys) {
                const value = key === '_' ? elem : isRecord(elem) ? elem[key] : undefined;
                if (matchCondition(value, where[key])) {
                    return true;
                }
            }
            return false;
        })
        if (arg.field) {
            return isRecord(r) ? r[arg.field] : arg.else;
        } else {
            return r || arg.else;
        }
    },
    $eval(arg: unknown, vars: Vars) {
        return isRecord(arg) ? vars.match(arg) : false;
    }
}

function runProjection(obj: unknown, vars: Vars) {
    if (isRecord(obj)) {
        const keys = Object.keys(obj)
        if (keys.length === 1) {
            const key = keys[0];
            const fn = operations[key];
            if (fn) {
                return fn(obj[key], vars);
            }
        }
    }
    return obj; // return the value as is
}

export function projectResult<TParams extends object>(payload: DSLActivityExecutionPayload<TParams>, params: TParams, result: unknown, fallback: unknown) {
    return payload.activity.projection ? makeProjection(payload.activity.projection, asRecord(params), result) : fallback;
}

export function makeProjection(spec: Record<string, unknown>, params: Record<string, unknown>, result: unknown) {
    const vars = new Vars({
        ...params,
        '#': result,
    });

    const projection = vars.resolveParams(spec);

    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(projection)) {
        out[key] = runProjection(value, vars);
    }

    return out;
}
