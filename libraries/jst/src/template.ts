import dayjs from 'dayjs';
import { addLineNumbers } from './functions/addLineNumbers.js';
import { jsonToCsv, loadCsv } from './functions/csv.js';
import { Script } from './script.js';
import { TEMPLATE_SYSTEM_VARIABLE_NAMES } from './system.js';
import { CompositeError } from './validation.js';

/** Identifiers every JST template can read besides its declared inputs. */
export const JST_TEMPLATE_GLOBALS: readonly string[] = ['_', 'Array', 'Set', ...TEMPLATE_SYSTEM_VARIABLE_NAMES];

export class CompiledTemplate extends Script<string> {
    constructor(code: string, globals: string[]) {
        // Deduplicate: the globals become a destructured parameter list, where a repeated name
        // (e.g. a schema that also declares `_model`) is a syntax error.
        super(code, [...new Set([...globals, ...JST_TEMPLATE_GLOBALS])]);
    }
    validate() {
        return super.validate({
            acorn: {
                allowReturnOutsideFunction: true,
                locations: true,
            },
        });
    }
    run(context: Record<string, unknown>): string {
        return super.run({ ...context, Set: Set, Array: Array });
    }
}
export function renderJsTemplate(code: string, globals: string[], data: Record<string, unknown>): string {
    const script = new CompiledTemplate(code, globals);
    const state = script.validate();
    if (state.hasErrors()) {
        throw new CompositeError(state.errors, 'Validation errors');
    }
    const content = script.run({
        ...data,
        _: {
            loadCsv,
            jsonToCsv,
            stringify: JSON.stringify,
            addLineNumbers: addLineNumbers,
            dayjs: dayjs,
        },
    });
    return content;
}
