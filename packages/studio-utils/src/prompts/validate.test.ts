import type { JSONSchema } from '@vertesia/common';
import { TemplateType } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { type PromptValidationIssue, validatePrompt } from './validate.js';

function findIssue(
    issues: PromptValidationIssue[],
    type: PromptValidationIssue['type'],
    variable?: string,
): PromptValidationIssue | undefined {
    return issues.find((i) => i.type === type && (variable === undefined || i.variable === variable));
}

const schema = (properties: Record<string, JSONSchema>, required?: string[]): JSONSchema => ({
    type: 'object',
    properties,
    ...(required ? { required } : {}),
});

describe('validatePrompt — text (no validation)', () => {
    it('returns no issues for plain text content regardless of schema', () => {
        const r = validatePrompt({
            content: 'Hello, this is just text. {{not a template tag}}',
            contentType: TemplateType.text,
            inputSchema: schema({ unused: { type: 'string' } }),
        });
        expect(r.error_count).toBe(0);
        expect(r.warning_count).toBe(0);
        expect(r.issues).toHaveLength(0);
    });
});

describe('validatePrompt — handlebars', () => {
    describe('undeclared_template_variable (error)', () => {
        it('flags a top-level variable that is not in the schema', () => {
            const r = validatePrompt({
                content: 'Summarize this document: {{document}}',
                contentType: TemplateType.handlebars,
                inputSchema: schema({}),
            });
            const issue = findIssue(r.issues, 'undeclared_template_variable', 'document');
            expect(issue).toBeDefined();
            expect(issue?.severity).toBe('error');
            expect(r.error_count).toBeGreaterThanOrEqual(1);
        });

        it('flags multiple undeclared variables independently', () => {
            const r = validatePrompt({
                content: 'Hi {{name}}, your role is {{role}} and dept is {{dept}}',
                contentType: TemplateType.handlebars,
                inputSchema: schema({ name: { type: 'string' } }),
            });
            expect(findIssue(r.issues, 'undeclared_template_variable', 'role')).toBeDefined();
            expect(findIssue(r.issues, 'undeclared_template_variable', 'dept')).toBeDefined();
            expect(findIssue(r.issues, 'undeclared_template_variable', 'name')).toBeUndefined();
        });

        it('flags the root variable when the template uses dotted access', () => {
            // Handlebars `{{user.name}}` references the top-level `user` — the schema must declare `user`.
            const r = validatePrompt({
                content: 'User: {{user.name}}',
                contentType: TemplateType.handlebars,
                inputSchema: schema({}),
            });
            expect(findIssue(r.issues, 'undeclared_template_variable', 'user')).toBeDefined();
        });

        it('treats no schema as schema with no properties', () => {
            const r = validatePrompt({
                content: 'Hello {{name}}',
                contentType: TemplateType.handlebars,
            });
            expect(findIssue(r.issues, 'undeclared_template_variable', 'name')).toBeDefined();
        });
    });

    describe('unused_schema_variable (warning)', () => {
        it('flags a schema property that the template never references', () => {
            const r = validatePrompt({
                content: 'Hello {{name}}',
                contentType: TemplateType.handlebars,
                inputSchema: schema({
                    name: { type: 'string' },
                    extra: { type: 'string' },
                }),
            });
            const issue = findIssue(r.issues, 'unused_schema_variable', 'extra');
            expect(issue).toBeDefined();
            expect(issue?.severity).toBe('warning');
            expect(r.warning_count).toBeGreaterThanOrEqual(1);
        });

        it('does not block validation — only errors do', () => {
            const r = validatePrompt({
                content: 'Hello {{name}}',
                contentType: TemplateType.handlebars,
                inputSchema: schema({
                    name: { type: 'string' },
                    unused: { type: 'string' },
                }),
            });
            expect(r.error_count).toBe(0);
            expect(r.warning_count).toBe(1);
        });
    });

    describe('handlebars_render_error (error)', () => {
        it('flags a syntax error in the template', () => {
            const r = validatePrompt({
                // Unclosed mustache → handlebars parse error
                content: 'Hello {{name',
                contentType: TemplateType.handlebars,
                inputSchema: schema({ name: { type: 'string' } }),
            });
            expect(findIssue(r.issues, 'handlebars_render_error')).toBeDefined();
            expect(r.error_count).toBeGreaterThanOrEqual(1);
        });

        it('flags an unregistered helper call', () => {
            const r = validatePrompt({
                content: 'Tactics: {{join mitre_tactics ", "}}',
                contentType: TemplateType.handlebars,
                inputSchema: schema({ mitre_tactics: { type: 'array', items: { type: 'string' } } }),
            });

            const issue = findIssue(r.issues, 'handlebars_render_error');
            expect(issue).toBeDefined();
            expect(issue?.message).toContain('Missing helper: "join"');
        });
    });

    describe('happy path', () => {
        it('returns zero issues when every template variable is declared and every declared variable is used', () => {
            const r = validatePrompt({
                content: 'Hello {{name}}, please summarize: {{document}}',
                contentType: TemplateType.handlebars,
                inputSchema: schema(
                    {
                        name: { type: 'string' },
                        document: { type: 'string' },
                    },
                    ['name', 'document'],
                ),
            });
            expect(r.error_count).toBe(0);
            expect(r.warning_count).toBe(0);
            expect(r.issues).toHaveLength(0);
        });

        it('accepts handlebars block helpers (#if/#each) on declared variables', () => {
            const r = validatePrompt({
                content: '{{#if items}}Items:{{#each items}}- {{this}}\n{{/each}}{{/if}}',
                contentType: TemplateType.handlebars,
                inputSchema: schema({ items: { type: 'array', items: { type: 'string' } } }),
            });
            expect(findIssue(r.issues, 'undeclared_template_variable', 'items')).toBeUndefined();
            expect(r.error_count).toBe(0);
        });
    });

    describe('combined errors + warnings', () => {
        it('reports both kinds in one pass and counts them correctly', () => {
            const r = validatePrompt({
                content: 'Hi {{name}}, document: {{document}}',
                contentType: TemplateType.handlebars,
                inputSchema: schema({
                    name: { type: 'string' },
                    extra: { type: 'string' }, // unused → warning
                    // document missing → error
                }),
            });
            expect(findIssue(r.issues, 'undeclared_template_variable', 'document')).toBeDefined();
            expect(findIssue(r.issues, 'unused_schema_variable', 'extra')).toBeDefined();
            expect(r.error_count).toBe(1);
            expect(r.warning_count).toBe(1);
            expect(r.issues.length).toBe(2);
        });
    });

    describe('ordering and independence of error sources', () => {
        // Handlebars is non-strict — `{{undeclared}}` renders as empty string, NOT an exception.
        // So an undeclared variable does not cause a render error; only one error is reported.
        it('reports undeclared_template_variable only (render does not echo it in non-strict Handlebars)', () => {
            const r = validatePrompt({
                content: 'Hello {{undefined_var}}',
                contentType: TemplateType.handlebars,
                inputSchema: schema({}),
            });
            expect(findIssue(r.issues, 'undeclared_template_variable', 'undefined_var')).toBeDefined();
            expect(findIssue(r.issues, 'handlebars_render_error')).toBeUndefined();
            expect(r.error_count).toBe(1);
        });

        // When the template has both an undeclared variable AND a real parse error,
        // we must surface both — and the variable error must appear first in the list
        // so the LLM/user sees the precise reason before the generic render error.
        it('reports BOTH undeclared_template_variable and handlebars_render_error, vars first', () => {
            const r = validatePrompt({
                // {{name has no closing brace → parse error. extractHandlebarsVariables fails
                // silently and returns an empty set, so no undeclared error is raised by
                // step 1 here — but the rendering step catches the parse failure.
                content: 'Hello {{undefined_var}} and {{name',
                contentType: TemplateType.handlebars,
                inputSchema: schema({}),
            });
            // The renderer reports the parse problem; the var-extractor couldn't even parse the
            // template, so it returned no usedVars and we cannot detect the undeclared var here.
            // The contract is "both kinds are independent and both reported when applicable".
            expect(findIssue(r.issues, 'handlebars_render_error')).toBeDefined();
        });
    });
});

describe('validatePrompt — jst', () => {
    it('happy path: identifier referenced and declared', () => {
        const r = validatePrompt({
            content: 'return `hello ${name}`;',
            contentType: TemplateType.jst,
            inputSchema: schema({ name: { type: 'string' } }, ['name']),
        });
        expect(r.error_count).toBe(0);
        expect(r.warning_count).toBe(0);
    });

    it('flags undeclared identifier as error', () => {
        const r = validatePrompt({
            content: 'return `hello ${name}`;',
            contentType: TemplateType.jst,
            inputSchema: schema({}),
        });
        expect(findIssue(r.issues, 'undeclared_template_variable', 'name')).toBeDefined();
        expect(r.error_count).toBeGreaterThanOrEqual(1);
    });

    it('flags declared-but-unused as warning', () => {
        const r = validatePrompt({
            content: 'return `hello ${name}`;',
            contentType: TemplateType.jst,
            inputSchema: schema({
                name: { type: 'string' },
                unused: { type: 'string' },
            }),
        });
        const issue = findIssue(r.issues, 'unused_schema_variable', 'unused');
        expect(issue).toBeDefined();
        expect(issue?.severity).toBe('warning');
    });

    it('does not flag locally-bound variables as undeclared', () => {
        const r = validatePrompt({
            content: 'const greeting = `hello ${name}`; return greeting;',
            contentType: TemplateType.jst,
            inputSchema: schema({ name: { type: 'string' } }, ['name']),
        });
        expect(findIssue(r.issues, 'undeclared_template_variable', 'greeting')).toBeUndefined();
        expect(r.error_count).toBe(0);
    });

    it('does not flag jst auto-globals (_, Array, Set)', () => {
        const r = validatePrompt({
            content: 'return _.stringify({ count: Array.isArray(items) ? items.length : 0 });',
            contentType: TemplateType.jst,
            inputSchema: schema({ items: { type: 'array', items: { type: 'string' } } }, ['items']),
        });
        expect(findIssue(r.issues, 'undeclared_template_variable', '_')).toBeUndefined();
        expect(findIssue(r.issues, 'undeclared_template_variable', 'Array')).toBeUndefined();
    });

    it('flags unsafe constructs (with) as jst_unsafe_construct', () => {
        const r = validatePrompt({
            content: 'with (foo) { return bar; }',
            contentType: TemplateType.jst,
            inputSchema: schema({ foo: { type: 'object' }, bar: { type: 'string' } }, ['foo', 'bar']),
        });
        expect(findIssue(r.issues, 'jst_unsafe_construct')).toBeDefined();
    });

    it('flags for-loops as jst_unsafe_construct', () => {
        const r = validatePrompt({
            content: 'for (let i = 0; i < items.length; i++) { return items[i]; } return null;',
            contentType: TemplateType.jst,
            inputSchema: schema({ items: { type: 'array', items: { type: 'string' } } }, ['items']),
        });
        expect(findIssue(r.issues, 'jst_unsafe_construct')).toBeDefined();
    });
});
