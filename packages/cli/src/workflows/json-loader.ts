import { readFile } from 'node:fs/promises';
import type { DSLWorkflowSpec } from '@vertesia/common';
import { errorMessage } from '../utils/options.js';
import { ValidationError, validateWorkflow } from './validation.js';

function parseJSON(content: string): DSLWorkflowSpec {
    try {
        return JSON.parse(content);
    } catch (err: unknown) {
        throw new ValidationError(`Invalid JSON: ${errorMessage(err)}`);
    }
}

export async function loadJSONWorkflowDefinition(
    file: string,
    skipValidation: boolean = false,
): Promise<DSLWorkflowSpec> {
    const spec = parseJSON(await readFile(file, 'utf-8'));
    return skipValidation ? spec : validateWorkflow(spec);
}
