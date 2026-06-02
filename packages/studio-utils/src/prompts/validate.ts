import type { JSONObject } from '@llumiverse/core';
import { type JSONSchema, TemplateType } from '@vertesia/common';
import { extractHandlebarsVariables } from './extract-vars.js';
import { generateMockData } from './mock-data.js';
import { executeHandlebars } from './render.js';

export type PromptValidationIssueType =
    | 'undeclared_template_variable'
    | 'unused_schema_variable'
    | 'handlebars_render_error';

export type PromptValidationIssueSeverity = 'error' | 'warning';

export interface PromptValidationIssue {
    /** Discriminator for issue kind */
    type: PromptValidationIssueType;
    /** Errors should block prompt creation; warnings are informational. */
    severity: PromptValidationIssueSeverity;
    /** The variable name when the issue is variable-related. */
    variable?: string;
    /** Human-readable message; safe to surface directly to an LLM tool error. */
    message: string;
}

export interface PromptValidationResult {
    /** Flat list of issues found. `severity` discriminates errors (blocking) from warnings. */
    issues: PromptValidationIssue[];
    /** Count of `severity: 'error'` entries in `issues`. Zero ⇔ validation passed. */
    error_count: number;
    /** Count of `severity: 'warning'` entries in `issues`. Non-blocking informational findings. */
    warning_count: number;
}

export interface PromptValidationInput {
    /** The prompt's template source. */
    content: string;
    /** Template language. Only `handlebars` is validated currently; other types pass through. */
    contentType: TemplateType;
    /** JSON Schema declaring the variables the template expects. */
    inputSchema?: JSONSchema;
}

/**
 * Validate a single prompt template against its declared input schema.
 *
 * Checks performed for Handlebars templates:
 *  1. Every variable referenced in the template must be declared as a top-level property
 *     in `inputSchema.properties` (else → `undeclared_template_variable` error).
 *  2. Every property declared in `inputSchema.properties` should be referenced by the template
 *     (else → `unused_schema_variable` warning — non-blocking).
 *  3. The template must render successfully against schema-derived mock data
 *     (else → `handlebars_render_error` error, e.g. for syntax errors or failing helpers).
 *
 * JST and text content types currently pass through with no issues — JST validation would
 * require a separate AST walker over its JavaScript subset.
 *
 * Returns a flat list of issues with `severity` discriminating blocking errors from warnings.
 * Callers (e.g., agent tools) can filter to errors before deciding whether to reject the operation.
 */
export function validatePrompt(input: PromptValidationInput): PromptValidationResult {
    const issues: PromptValidationIssue[] = [];

    if (input.contentType !== TemplateType.handlebars) {
        return { issues, error_count: 0, warning_count: 0 };
    }

    const usedVars = extractHandlebarsVariables(input.content);
    const declaredVars = new Set<string>(
        input.inputSchema?.properties ? Object.keys(input.inputSchema.properties) : [],
    );

    // 1. Template uses a variable not declared in the schema.
    for (const used of usedVars) {
        if (!declaredVars.has(used)) {
            issues.push({
                type: 'undeclared_template_variable',
                severity: 'error',
                variable: used,
                message: `Template references variable '{{${used}}}' but it is not declared in input_schema.properties. Add '${used}' to the schema with an appropriate type.`,
            });
        }
    }

    // 2. Schema declares a variable the template never uses (warning, non-blocking).
    for (const declared of declaredVars) {
        if (!usedVars.has(declared)) {
            issues.push({
                type: 'unused_schema_variable',
                severity: 'warning',
                variable: declared,
                message: `Schema declares property '${declared}' but the template never references it. Remove it from input_schema or use it via {{${declared}}}.`,
            });
        }
    }

    // 3. Render-time smoke test with synthesized mock data — catches syntax errors and failing helpers.
    const renderSchema = input.inputSchema ?? ({} as JSONSchema);
    const mockData = generateMockData(renderSchema);
    const mockObject: JSONObject =
        typeof mockData === 'object' && mockData !== null && !Array.isArray(mockData) ? (mockData as JSONObject) : {};
    const renderResult = executeHandlebars(input.content, renderSchema, mockObject);
    if (!renderResult.success) {
        issues.push({
            type: 'handlebars_render_error',
            severity: 'error',
            message: `Handlebars rendering failed: ${renderResult.error}`,
        });
    }

    let error_count = 0;
    let warning_count = 0;
    for (const issue of issues) {
        if (issue.severity === 'error') {
            error_count++;
        } else if (issue.severity === 'warning') {
            warning_count++;
        }
    }

    return { issues, error_count, warning_count };
}
