import { type ValidationOptions, validate } from './validation.js';

export class Script<ReturnT = unknown> {
    fn: (context: Record<string, unknown>) => ReturnT;
    constructor(
        public readonly code: string,
        public readonly globals: string[],
    ) {
        const args = globals && globals.length > 0 ? `{${globals.join(',')}}` : '';
        this.fn = new Function(args, `return (function(){"use strict";${code}})()`) as (
            context: Record<string, unknown>,
        ) => ReturnT;
    }

    validate(opts: ValidationOptions = {}) {
        return validate(this.code, Object.assign({ globals: this.globals }, opts));
    }

    run(context: Record<string, unknown>): ReturnT {
        return this.fn(context);
    }
}
