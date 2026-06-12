import type { DSLWorkflowSpec } from '@vertesia/common';
import { validateWorkflow as validate } from '@vertesia/workflow/vars';
export class ValidationError extends Error {
    constructor(message: string) {
        super(`Invalid workflow definition: ${message}`);
        this.name = 'ValidationError';
    }
}

export function validateWorkflow(spec: DSLWorkflowSpec): DSLWorkflowSpec {
    const errors = validate(spec);
    if (errors && errors.length > 0) {
        console.log('');
        console.log('# ');
        console.log('# The workflow has validation errors:');
        console.log('# ');
        console.log('');
        console.log(errors.map((v, i) => `${i + 1}. ${v}`).join('\n'));
        console.log('');
        throw new ValidationError('Exiting because of validation errors.');
    }
    return spec;
}
