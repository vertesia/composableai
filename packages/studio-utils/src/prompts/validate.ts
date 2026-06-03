import type { JSONObject } from '@llumiverse/core';
import { type JSONSchema, TemplateType } from '@vertesia/common';
import { getFreeVariables, renderJsTemplate } from '@vertesia/jst';
import { extractHandlebarsVariables } from './extract-vars.js';
import { generateMockData } from './mock-data.js';
import { executeHandlebars } from './render.js';

export type PromptValidationIssueType =
    | 'undeclared_template_variable'
    | 'unused_schema_variable'
    | 'handlebars_render_error'
    | 'jst_unsafe_construct'
    | 'jst_render_error';

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
    /** Template language. `handlebars` and `jst` are validated; `text` passes through. */
    contentType: TemplateType;
    /** JSON Schema declaring the variables the template expects. */
    inputSchema?: JSONSchema;
}

// JST's renderJsTemplate auto-adds `_` (helpers object) and runtime injects `Set` and `Array`
// — treat them as globals so they don't appear as free vars in user templates.
// Globals always available to JST templates regardless of schema:
//  - `_`, `Array`, `Set`: runtime-injected by `renderJsTemplate` (jst library)
//  - `_model`: runtime-injected by the studio-server executor as `{ ..._model: run.modelId }`
//    (see ExecutionRequest.ts:313 and executor/rendering/template.ts:13)
// Keeping these in sync with `renderTemplate` in ./render.ts so a JST template that runs in
// production also passes the validator.
const JST_AUTO_GLOBALS = ['_', 'Array', 'Set', '_model'];

function countSeverities(issues: PromptValidationIssue[]): { error_count: number; warning_count: number } {
    let error_count = 0;
    let warning_count = 0;
    for (const issue of issues) {
        if (issue.severity === 'error') {
            error_count++;
        } else if (issue.severity === 'warning') {
            warning_count++;
        }
    }
    return { error_count, warning_count };
}

function validateHandlebarsPrompt(content: string, inputSchema?: JSONSchema): PromptValidationIssue[] {
    const issues: PromptValidationIssue[] = [];
    const usedVars = extractHandlebarsVariables(content);
    const declaredVars = new Set<string>(inputSchema?.properties ? Object.keys(inputSchema.properties) : []);

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

    // Render-time smoke test — always runs so syntax errors and failing helper calls are
    // surfaced even when undeclared-variable errors are already in the list. Handlebars renders
    // missing vars as empty strings (non-strict by default), so the render check does NOT echo
    // the var errors — anything it reports is a distinct template problem worth showing.
    const renderSchema = inputSchema ?? ({} as JSONSchema);
    const mockData = generateMockData(renderSchema);
    const mockObject: JSONObject =
        typeof mockData === 'object' && mockData !== null && !Array.isArray(mockData) ? (mockData as JSONObject) : {};
    const renderResult = executeHandlebars(content, renderSchema, mockObject);
    if (!renderResult.success) {
        issues.push({
            type: 'handlebars_render_error',
            severity: 'error',
            message: `Handlebars rendering failed: ${renderResult.error}`,
        });
    }

    return issues;
}

function validateJstPrompt(content: string, inputSchema?: JSONSchema): PromptValidationIssue[] {
    const issues: PromptValidationIssue[] = [];
    const declaredVars = new Set<string>(inputSchema?.properties ? Object.keys(inputSchema.properties) : []);

    let referenced: Set<string>;
    try {
        const result = getFreeVariables(content, {
            globals: JST_AUTO_GLOBALS,
            acorn: { allowReturnOutsideFunction: true, locations: true },
        });
        referenced = result.vars;
        for (const err of result.errors) {
            issues.push({
                type: 'jst_unsafe_construct',
                severity: 'error',
                message: `JST validation error at ${err.location}: ${err.message}`,
            });
        }
    } catch (parseError) {
        // Acorn parse failure — surface as render error since the template can't be compiled.
        issues.push({
            type: 'jst_render_error',
            severity: 'error',
            message: `JST parse failed: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        });
        return issues;
    }

    for (const used of referenced) {
        if (!declaredVars.has(used)) {
            issues.push({
                type: 'undeclared_template_variable',
                severity: 'error',
                variable: used,
                message: `Template references variable '${used}' but it is not declared in input_schema.properties. Add '${used}' to the schema with an appropriate type.`,
            });
        }
    }

    for (const declared of declaredVars) {
        if (!referenced.has(declared)) {
            issues.push({
                type: 'unused_schema_variable',
                severity: 'warning',
                variable: declared,
                message: `Schema declares property '${declared}' but the template never references it. Remove it from input_schema or use it in the template.`,
            });
        }
    }

    // Render-time smoke test — only if there are no blocking errors so far, otherwise
    // the failure mode would just echo what we already reported.
    const blockingSoFar = issues.some((i) => i.severity === 'error');
    if (!blockingSoFar) {
        const renderSchema = inputSchema ?? ({} as JSONSchema);
        const mockData = generateMockData(renderSchema);
        const mockObject: JSONObject =
            typeof mockData === 'object' && mockData !== null && !Array.isArray(mockData)
                ? (mockData as JSONObject)
                : {};
        try {
            renderJsTemplate(content, [...declaredVars], mockObject);
        } catch (renderError) {
            issues.push({
                type: 'jst_render_error',
                severity: 'error',
                message: `JST rendering failed: ${renderError instanceof Error ? renderError.message : String(renderError)}`,
            });
        }
    }

    return issues;
}

/**
 * Validate a single prompt template against its declared input schema.
 *
 * For `handlebars` and `jst` templates, the following checks are performed:
 *  1. Every variable referenced in the template must be declared as a top-level property
 *     in `inputSchema.properties` (else → `undeclared_template_variable` error).
 *  2. Every property declared in `inputSchema.properties` should be referenced by the template
 *     (else → `unused_schema_variable` warning — non-blocking).
 *  3. The template must render successfully against schema-derived mock data
 *     (else → `handlebars_render_error` / `jst_render_error` error).
 *  4. For JST only: unsafe constructs (`with`, `for`, `while`, `import`, class, `this`,
 *     dynamic property lookup, blacklisted props) → `jst_unsafe_construct` error.
 *
 * `text` content type passes through with no issues.
 */
export function validatePrompt(input: PromptValidationInput): PromptValidationResult {
    let issues: PromptValidationIssue[];
    if (input.contentType === TemplateType.handlebars) {
        issues = validateHandlebarsPrompt(input.content, input.inputSchema);
    } else if (input.contentType === TemplateType.jst) {
        issues = validateJstPrompt(input.content, input.inputSchema);
    } else {
        issues = [];
    }
    const { error_count, warning_count } = countSeverities(issues);
    return { issues, error_count, warning_count };
}
