import { readFile } from 'node:fs/promises';
import type { DSLWorkflowSpec } from '@vertesia/common';
import { errorMessage } from '../utils/options.js';
import { ValidationError } from './validation.js';

function parseJSON(content: string): DSLWorkflowSpec {
    try {
        return JSON.parse(content);
    } catch (err: unknown) {
        throw new ValidationError(`Invalid JSON: ${errorMessage(err)}`);
    }
}

export async function loadJSONWorkflowDefinition(file: string): Promise<DSLWorkflowSpec> {
    return parseJSON(await readFile(file, 'utf-8'));
}
