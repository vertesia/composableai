import Ajv, { type ErrorObject } from 'ajv';
import type { ViewExperienceConfiguration } from './views.js';
import {
    PersistedViewExperienceConfigurationJsonSchema,
    ViewExperienceConfigurationJsonSchema,
} from './views-schema.js';
import { type ViewValidationIssue, validateViewExperienceSemantics } from './views-validation.js';

export type ViewConfigurationValidationMode = 'draft' | 'persisted';

const ajv = new Ajv.default({ allErrors: true, strict: false });
const validateDraftStructure = ajv.compile(ViewExperienceConfigurationJsonSchema);
const validatePersistedStructure = ajv.compile(PersistedViewExperienceConfigurationJsonSchema);

function jsonPointerPath(instancePath: string): string {
    if (instancePath === '') return 'configuration';
    return instancePath
        .slice(1)
        .split('/')
        .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
        .reduce((path, segment) => {
            if (/^\d+$/.test(segment)) return `${path}[${segment}]`;
            return path.length === 0 ? segment : `${path}.${segment}`;
        }, '');
}

function errorPath(error: ErrorObject): string {
    const base = jsonPointerPath(error.instancePath);
    if (error.keyword === 'required' && 'missingProperty' in error.params) {
        const missingProperty = String(error.params.missingProperty);
        return base === 'configuration' ? missingProperty : `${base}.${missingProperty}`;
    }
    if (error.keyword === 'additionalProperties' && 'additionalProperty' in error.params) {
        const additionalProperty = String(error.params.additionalProperty);
        return base === 'configuration' ? additionalProperty : `${base}.${additionalProperty}`;
    }
    return base;
}

function structuralIssues(value: unknown, mode: ViewConfigurationValidationMode): ViewValidationIssue[] {
    const validateStructure = mode === 'persisted' ? validatePersistedStructure : validateDraftStructure;
    if (validateStructure(value)) return [];
    const issues = (validateStructure.errors ?? []).map((error: ErrorObject) => ({
        path: errorPath(error),
        message: error.message ?? 'is invalid',
    }));
    return [...new Map(issues.map((issue) => [`${issue.path}\u0000${issue.message}`, issue])).values()];
}

/**
 * Validate both the canonical JSON structure and semantic cross-reference rules.
 *
 * Persisted mode adds the documentation requirement structurally. Blank
 * descriptions pass the shape check and are rejected by semantic validation,
 * while structure-first short-circuiting prevents duplicate errors.
 */
export function validateViewConfiguration(
    value: unknown,
    mode: ViewConfigurationValidationMode = 'draft',
): ViewValidationIssue[] {
    const issues = structuralIssues(value, mode);
    if (issues.length > 0) return issues;
    return validateViewExperienceSemantics(value as ViewExperienceConfiguration, mode);
}

/** @deprecated Use validateViewConfiguration(value, 'draft'). */
export function validateViewExperienceConfiguration(value: unknown): ViewValidationIssue[] {
    return validateViewConfiguration(value, 'draft');
}

/** @deprecated Use validateViewConfiguration(value, 'persisted'). */
export function validatePersistedViewExperienceConfiguration(value: unknown): ViewValidationIssue[] {
    return validateViewConfiguration(value, 'persisted');
}
