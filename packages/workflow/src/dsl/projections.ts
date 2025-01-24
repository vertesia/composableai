import { DSLActivityExecutionPayload } from "@vertesia/common";
import { matchCondition } from "./conditions.js";
import { Vars } from "./vars.js";


interface ProjectOperation {
    (arg: any, vars: Vars): any
}

interface ElementOperation {
    field?: string,
    from: any[],
    where: Record<string, any>,
    else: any
}
const operations: Record<string, ProjectOperation> = {
    $element(arg: ElementOperation, _vars: Vars) {
        const where = arg.where;
        const whereKeys = Object.keys(where);
        const r = arg.from.find((elem: any) => {
            for (const key of whereKeys) {
                const value = key === '_' ? elem : elem[key];
                if (matchCondition(value, where[key])) {
                    return true;
                }
            }
            return false;
        })
        if (arg.field) {
            return r ? r[arg.field] : arg.else;
        } else {
            return r || arg.else;
        }
    },
    $eval(arg: any, vars: Vars) {
        return vars.match(arg);
    }
}

function runProjection(obj: any, vars: Vars) {
    if (obj && !Array.isArray(obj) && typeof obj === "object") {
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

export function projectResult<TParams extends Record<string, any>>(payload: DSLActivityExecutionPayload<TParams>, params: Record<string, any>, result: any, fallback: any) {
    return payload.activity.projection ? makeProjection(payload.activity.projection, params, result) : fallback;
}

export function makeProjection(spec: Record<string, any>, params: Record<string, any>, result: any) {
    const vars = new Vars({
        ...params,
        '#': result,
    });

    const projection = vars.resolveParams(spec);

    const out: any = {}
    for (const [key, value] of Object.entries(projection)) {
        out[key] = runProjection(value, vars);
    }

    return out;
}
