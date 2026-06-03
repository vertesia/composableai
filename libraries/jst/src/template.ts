import dayjs from 'dayjs';
import { addLineNumbers } from './functions/addLineNumbers.js';
import { jsonToCsv, loadCsv } from './functions/csv.js';
import { Script } from './script.js';
import { CompositeError } from './validation.js';

export class CompiledTemplate extends Script<string> {
    constructor(code: string, globals: string[]) {
        super(code, globals.concat('_', 'Array', 'Set'));
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
