import type { JSONObject } from '@llumiverse/common';
import { type JSONSchema, TemplateType } from '@vertesia/common';
import {
    describeTemplateSystemVariables,
    getFreeVariables,
    isTemplateSystemVariable,
    JST_TEMPLATE_GLOBALS,
    renderJsTemplate,
    TEMPLATE_SYSTEM_VARIABLES,
    withTemplateSystemVariables,
} from '@vertesia/jst';
import { analyzeHandlebarsTemplate } from './extract-vars.js';
import { generateMockData } from './mock-data.js';
import { executeHandlebars } from './render.js';

export type PromptValidationIssueType =
    | 'undeclared_template_variable'
    | 'unused_schema_variable'
    | 'reserved_variable_declared'
    | 'system_variable_property_access'
    | 'helper_used_as_value'
    | 'helper_missing_arguments'
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

/** Mock data for the render smoke test: schema-shaped input plus the runtime system values. */
function buildMockInput(inputSchema: JSONSchema): Record<string, unknown> {
    const mockData = generateMockData(inputSchema);
    const mockObject: JSONObject =
        typeof mockData === 'object' && mockData !== null && !Array.isArray(mockData) ? (mockData as JSONObject) : {};
    return withTemplateSystemVariables(mockObject, { model: 'validation-model' });
}

/**
 * Issues shared by both template languages: reserved names declared in the schema, and
 * unused schema properties. `usedVars` holds the input variables the template reads.
 */
function checkDeclarations(
    declaredVars: Set<string>,
    usedVars: Set<string>,
    usageHint: (name: string) => string,
): PromptValidationIssue[] {
    const issues: PromptValidationIssue[] = [];
    for (const declared of declaredVars) {
        if (isTemplateSystemVariable(declared)) {
            issues.push({
                type: 'reserved_variable_declared',
                severity: 'warning',
                variable: declared,
                message: `Schema declares '${declared}', a system variable the runtime supplies and overrides. Remove it from input_schema.`,
            });
        } else if (!usedVars.has(declared)) {
            issues.push({
                type: 'unused_schema_variable',
                severity: 'warning',
                variable: declared,
                message: `Schema declares property '${declared}' but the template never references it. Remove it from input_schema or ${usageHint(declared)}.`,
            });
        }
    }
    return issues;
}

function undeclaredVariableIssue(name: string, where: string): PromptValidationIssue {
    return {
        type: 'undeclared_template_variable',
        severity: 'error',
        variable: name,
        message:
            `Template reads variable '${name}' ${where} but it is not declared in input_schema.properties. ` +
            `Add '${name}' to the schema with an appropriate type. ` +
            `System variables need no declaration: ${describeTemplateSystemVariables()}.`,
    };
}

function validateHandlebarsPrompt(content: string, inputSchema?: JSONSchema): PromptValidationIssue[] {
    const issues: PromptValidationIssue[] = [];
    const analysis = analyzeHandlebarsTemplate(content);
    const declaredVars = new Set<string>(inputSchema?.properties ? Object.keys(inputSchema.properties) : []);
    const usedVars = new Set<string>();
    const reported = new Set<string>();

    for (const ref of analysis?.references ?? []) {
        if (isTemplateSystemVariable(ref.name)) {
            const variable = TEMPLATE_SYSTEM_VARIABLES.find((v) => v.name === ref.name);
            if (ref.hasPath && variable?.type === 'string' && !reported.has(`path:${ref.expression}`)) {
                reported.add(`path:${ref.expression}`);
                issues.push({
                    type: 'system_variable_property_access',
                    severity: 'error',
                    variable: ref.name,
                    message: `'${ref.expression}' in ${ref.tag} reads a property of system variable '${ref.name}', which is a string (${variable.description}). Use '${ref.name}' directly.`,
                });
            }
            continue;
        }
        usedVars.add(ref.name);
        if (!declaredVars.has(ref.name) && !reported.has(ref.name)) {
            reported.add(ref.name);
            issues.push(undeclaredVariableIssue(ref.name, `in ${ref.tag}`));
        }
    }

    for (const misuse of analysis?.helperMisuses ?? []) {
        issues.push(
            misuse.problem === 'used_as_value'
                ? {
                      type: 'helper_used_as_value',
                      severity: 'error',
                      variable: misuse.helper,
                      message: `'${misuse.helper}' in ${misuse.tag} is a helper, but as an argument Handlebars reads it as data, which is empty. Call it as a subexpression: (${misuse.helper} ...).`,
                  }
                : {
                      type: 'helper_missing_arguments',
                      severity: 'error',
                      variable: misuse.helper,
                      message: `${misuse.tag} calls helper '${misuse.helper}' without arguments. Pass the value it operates on, e.g. {{${misuse.helper} value}}.`,
                  },
        );
    }

    issues.push(...checkDeclarations(declaredVars, usedVars, (name) => `use it via {{${name}}}`));

    // Render-time smoke test — always runs so syntax errors and failing helper calls are
    // surfaced even when undeclared-variable errors are already in the list. Handlebars renders
    // missing vars as empty strings (non-strict by default), so the render check does NOT echo
    // the var errors — anything it reports is a distinct template problem worth showing.
    const renderSchema = inputSchema ?? ({} as JSONSchema);
    const renderResult = executeHandlebars(content, renderSchema, buildMockInput(renderSchema) as JSONObject);
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
            globals: [...JST_TEMPLATE_GLOBALS],
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
            issues.push(undeclaredVariableIssue(used, 'in the template'));
        }
    }

    issues.push(...checkDeclarations(declaredVars, referenced, () => 'use it in the template'));

    // Render-time smoke test — only if there are no blocking errors so far, otherwise
    // the failure mode would just echo what we already reported.
    const blockingSoFar = issues.some((i) => i.severity === 'error');
    if (!blockingSoFar) {
        const renderSchema = inputSchema ?? ({} as JSONSchema);
        try {
            renderJsTemplate(content, [...declaredVars], buildMockInput(renderSchema));
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
 *     in `inputSchema.properties` (else → `undeclared_template_variable` error). System variables
 *     (`TEMPLATE_SYSTEM_VARIABLES` in `@vertesia/jst`) are supplied at runtime and need no declaration;
 *     declaring one → `reserved_variable_declared` warning, reading a property of one →
 *     `system_variable_property_access` error.
 *  2. Every property declared in `inputSchema.properties` should be referenced by the template
 *     (else → `unused_schema_variable` warning — non-blocking).
 *  For Handlebars only: a helper passed as an argument (`{{#if stringify}}`) →
 *     `helper_used_as_value` error; a helper called bare without the arguments it needs
 *     (`{{stringify}}`) → `helper_missing_arguments` error.
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
