import equal from 'fast-deep-equal';

function $exists(value: unknown, arg: boolean) {
    return (value !== undefined) === arg;
}
function $null(value: unknown, arg: boolean) {
    return (value == null) === arg;
}

function $eq(value: unknown, arg: unknown) {
    if (Array.isArray(arg)) {
        return equal(value, arg);
    } else if (typeof arg === 'object') {
        return equal(value, arg);
    } else {
        return value === arg;
    }
}
function $ne(value: unknown, arg: unknown) {
    return !$eq(value, arg);
}
function $or(value: unknown, arg: unknown[]) {
    return arg.some(c => matchCondition(value, c));
}
function $in(value: unknown, arg: unknown[]) {
    return arg.includes(value);
}
function $nin(value: unknown, arg: unknown[]) {
    return !$in(value, arg);
}
function $regexp(value: string, arg: string) {
    return new RegExp(arg).test(value);
}
function $endsWith(value: string, arg: string) {
    return value.endsWith(arg);
}
function $startsWith(value: string, arg: string) {
    return value.startsWith(arg);
}
function $contains(value: string, arg: string) {
    return value.includes(arg);
}
function $lt(value: number, arg: number) {
    return value < arg;
}
function $gt(value: number, arg: number) {
    return value > arg;
}
function $lte(value: number, arg: number) {
    return value <= arg;
}
function $gte(value: number, arg: number) {
    return value >= arg;
}

type ConditionFn = (value: unknown, arg: unknown) => boolean;

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

const conditionFns: Record<string, ConditionFn> = {
    $exists: (value, arg) => typeof arg === 'boolean' && $exists(value, arg),
    $null: (value, arg) => typeof arg === 'boolean' && $null(value, arg),
    $eq,
    $ne,
    $in: (value, arg) => Array.isArray(arg) && $in(value, arg),
    $nin: (value, arg) => Array.isArray(arg) && $nin(value, arg),
    $regexp: (value, arg) => typeof value === 'string' && typeof arg === 'string' && $regexp(value, arg),
    $startsWith: (value, arg) => typeof value === 'string' && typeof arg === 'string' && $startsWith(value, arg),
    $endsWith: (value, arg) => typeof value === 'string' && typeof arg === 'string' && $endsWith(value, arg),
    $contains: (value, arg) => typeof value === 'string' && typeof arg === 'string' && $contains(value, arg),
    $lt: (value, arg) => typeof value === 'number' && typeof arg === 'number' && $lt(value, arg),
    $gt: (value, arg) => typeof value === 'number' && typeof arg === 'number' && $gt(value, arg),
    $lte: (value, arg) => typeof value === 'number' && typeof arg === 'number' && $lte(value, arg),
    $gte: (value, arg) => typeof value === 'number' && typeof arg === 'number' && $gte(value, arg),
    $or: (value, arg) => Array.isArray(arg) && $or(value, arg),
}

export function matchCondition(value: unknown, conditions: unknown) {
    if (!isRecord(conditions)) {
        return $eq(value, conditions);
    }
    for (const key of Object.keys(conditions)) {
        const cond = conditionFns[key];
        if (!cond) {
            throw new Error(`Unknown condition: ${key}`);
        }
        if (!cond(value, conditions[key])) {
            return false;
        }
    }
    return true;
}
