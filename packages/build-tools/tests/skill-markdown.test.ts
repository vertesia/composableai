/**
 * Tests for the skill Markdown preprocessor.
 *
 * The contract is narrow on purpose: four constructs are recognised, everything else is prose
 * and must survive byte-for-byte. Most of these tests are about what the preprocessor must
 * *not* touch — that is where a "small semantic resolver" turns into a template engine.
 */

import { describe, expect, it } from 'vitest';
import { assertSkillMarkdown, preprocessSkillMarkdown } from '../src/core/skill-markdown/preprocess.js';
import {
    checkDispatchDescriptor,
    createSchemaExampleValidator,
    createSchemaFieldValidator,
} from '../src/core/skill-markdown/schema-validator.js';

const catalog = {
    tools: new Set(['search_documents', 'batch_execute', 'fetch_document']),
    skills: new Set(['workstreams', 'document_management']),
};

describe('reference rendering', () => {
    it('renders a tool reference as inline code and a skill reference with the learn_ prefix', () => {
        const result = preprocessSkillMarkdown(
            'Use {@tool search_documents}, or call {@skill workstreams} first.',
            catalog,
        );

        expect(result.markdown).toBe('Use `search_documents`, or call `learn_workstreams` first.');
        expect(result.errors).toEqual([]);
        expect(result.references).toEqual([
            { kind: 'tool', name: 'search_documents', rendered: '`search_documents`', line: 1, resolved: true },
            { kind: 'skill', name: 'workstreams', rendered: '`learn_workstreams`', line: 1, resolved: true },
        ]);
    });

    it('reports an unresolved reference with its line, and leaves the source text in place', () => {
        const result = preprocessSkillMarkdown('intro\n\nUse {@tool ghost_tool} here.', catalog);

        expect(result.errors).toEqual(["line 3: '{@tool ghost_tool}' refers to a tool no provider registers"]);
        expect(result.references[0]).toMatchObject({ name: 'ghost_tool', resolved: false });
        // Still rendered: one broken reference must not corrupt the rest of the document.
        expect(result.markdown).toContain('`ghost_tool`');
    });

    it('rejects an unknown construct rather than passing it through as prose', () => {
        const result = preprocessSkillMarkdown('See {@tolo search_documents}.', catalog);

        expect(result.errors[0]).toContain("unknown construct '{@tolo");
        expect(result.markdown).toBe('See {@tolo search_documents}.');
    });

    it('rejects a construct that does not name exactly one target', () => {
        const result = preprocessSkillMarkdown('{@tool} and {@tool a b} and {@skill Bad_Name}', catalog);

        expect(result.errors).toHaveLength(3);
        expect(result.errors.every((e) => e.includes('must name exactly one'))).toBe(true);
    });
});

describe('what must not be touched', () => {
    it('leaves prose that merely mentions a tool name alone', () => {
        const source = 'Use `execute_parallel_work_streams` with `customer_orders`, or search_documents.';
        expect(preprocessSkillMarkdown(source, catalog).markdown).toBe(source);
        expect(preprocessSkillMarkdown(source, catalog).references).toEqual([]);
    });

    it('does not substitute inside an inline code span, so the syntax can be documented', () => {
        const source = 'Write `{@tool search_documents}` to reference a tool.';
        const result = preprocessSkillMarkdown(source, catalog);

        expect(result.markdown).toBe(source);
        expect(result.references).toEqual([]);
    });

    it('does not substitute inside a fenced block', () => {
        const source = ['Example source:', '', '```markdown', 'Use {@skill workstreams}.', '```', ''].join('\n');
        expect(preprocessSkillMarkdown(source, catalog).markdown).toBe(source);
    });

    it('round-trips numeric prose next to a construct', () => {
        // Regression: an earlier masking scheme used ` <n> ` as its placeholder and corrupted this.
        const source = 'Up to 100 items, 3 at a time, via {@tool batch_execute} — see `x` and 42 more.';
        expect(preprocessSkillMarkdown(source, catalog).markdown).toBe(
            'Up to 100 items, 3 at a time, via `batch_execute` — see `x` and 42 more.',
        );
    });

    it('preserves blank lines, indentation and trailing newline exactly', () => {
        const source = '# Title\n\n  indented\n\n```\nraw\n```\n\ntail\n';
        expect(preprocessSkillMarkdown(source, catalog).markdown).toBe(source);
    });
});

describe('tagged examples', () => {
    const tagged = (body: string, tag = 'tool=batch_execute') => `Text\n\n\`\`\`json ${tag}\n${body}\n\`\`\`\n`;

    it('strips the validation tag from the rendered fence but keeps the language', () => {
        const result = preprocessSkillMarkdown(tagged('{ "a": 1 }'), catalog);

        expect(result.markdown).toBe('Text\n\n```json\n{ "a": 1 }\n```\n');
        expect(result.examples).toHaveLength(1);
        expect(result.examples[0]).toMatchObject({ tool: 'batch_execute', lang: 'json', value: { a: 1 } });
        expect(result.errors).toEqual([]);
    });

    /**
     * A file authored on Windows leaves a `\r` on every line, and a fence pattern built from `.`
     * cannot cross one — so every fence in such a file went unseen: tags unstripped and reaching
     * the model, payloads unvalidated, and no error to say so. The tag must go and the file's own
     * line endings must survive.
     */
    it('handles a fence in a CRLF document without changing its line endings', () => {
        const source = 'Text\r\n\r\n```json tool=batch_execute\r\n{ "a": 1 }\r\n```\r\n';
        const result = preprocessSkillMarkdown(source, catalog);

        expect(result.markdown).toBe('Text\r\n\r\n```json\r\n{ "a": 1 }\r\n```\r\n');
        expect(result.examples).toMatchObject([{ tool: 'batch_execute', lang: 'json', value: { a: 1 } }]);
        expect(result.errors).toEqual([]);
    });

    /**
     * A section titled after a tool states which tool its examples belong to. That is the only
     * evidence that distinguishes two tools declaring the same generic fields, which is exactly
     * where the field-overlap check gives up.
     */
    describe('heading agreement', () => {
        it('reports a tag that contradicts the heading it sits under', () => {
            const source = '## batch_execute\n\n```json tool=fetch_document\n{ "id": "a" }\n```\n';
            const errors = preprocessSkillMarkdown(source, catalog).errors;

            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain("tagged 'tool=fetch_document' under the heading for 'batch_execute'");
        });

        it('accepts the heading written as a construct or a code span', () => {
            for (const heading of ['## {@tool batch_execute}', '## `batch_execute`']) {
                const source = `${heading}\n\n\`\`\`json tool=batch_execute\n{ "a": 1 }\n\`\`\`\n`;
                expect(preprocessSkillMarkdown(source, catalog).errors, heading).toEqual([]);
            }
        });

        it('says nothing when the heading names no tool, or a later one clears it', () => {
            const prose = '## Batch operations\n\n```json tool=fetch_document\n{ "id": "a" }\n```\n';
            const cleared = '## batch_execute\n\n### Reading a document\n\n```json tool=fetch_document\n{}\n```\n';

            expect(preprocessSkillMarkdown(prose, catalog).errors).toEqual([]);
            expect(preprocessSkillMarkdown(cleared, catalog).errors).toEqual([]);
        });
    });

    it('leaves an untagged fence entirely alone and records no example', () => {
        const source = 'Text\n\n```json\n{ "a": 1 }\n```\n';
        const result = preprocessSkillMarkdown(source, catalog);

        expect(result.markdown).toBe(source);
        expect(result.examples).toEqual([]);
    });

    it('fails a tag naming a tool no provider registers', () => {
        const result = preprocessSkillMarkdown(tagged('{}', 'tool=ghost_tool'), catalog);
        expect(result.errors[0]).toContain("is tagged for 'ghost_tool', which no provider registers");
    });

    it('fails a tagged fence whose body is not strict JSON', () => {
        const result = preprocessSkillMarkdown(tagged('{ a: 1, }'), catalog);
        expect(result.errors[0]).toContain('is not strict JSON');
        expect(result.examples[0].value).toBeUndefined();
    });

    it('delegates schema and dispatch judgement to the caller', () => {
        const seen: Array<{ tool: string; value: unknown }> = [];
        const result = preprocessSkillMarkdown(tagged('{ "tool_name": "fetch_document" }'), {
            ...catalog,
            validateExample: (example) => {
                seen.push(example);
                return ['forwards an input to fetch_document that does not satisfy its schema'];
            },
        });

        expect(seen).toEqual([{ tool: 'batch_execute', value: { tool_name: 'fetch_document' } }]);
        expect(result.errors).toEqual([
            'line 3: example forwards an input to fetch_document that does not satisfy its schema',
        ]);
    });

    it('does not call the validator when the body failed to parse', () => {
        let called = false;
        preprocessSkillMarkdown(tagged('not json'), {
            ...catalog,
            validateExample: () => {
                called = true;
                return [];
            },
        });
        expect(called).toBe(false);
    });
});

describe('assertSkillMarkdown', () => {
    it('returns the result when the document is clean', () => {
        expect(assertSkillMarkdown('Use {@tool batch_execute}.', catalog, 'x.md').markdown).toBe(
            'Use `batch_execute`.',
        );
    });

    it('throws once, listing every problem, so one build run surfaces them all', () => {
        expect(() => assertSkillMarkdown('{@tool ghost}\n{@skill nope}', catalog, 'x.md')).toThrow(
            /x\.md:[\s\S]*ghost[\s\S]*nope/,
        );
    });
});

describe('ambiguous names', () => {
    const ambiguous = {
        ...catalog,
        skills: new Set([...catalog.skills, 'prompt_engineering']),
        tools: new Set([...catalog.tools, 'render']),
        ambiguousSkills: new Set(['prompt_engineering']),
        ambiguousTools: new Set(['render']),
    };

    it('rejects an unqualified reference to a name more than one provider defines', () => {
        const result = preprocessSkillMarkdown('{@skill prompt_engineering} and {@tool render}', ambiguous);

        expect(result.errors).toHaveLength(2);
        expect(result.errors[0]).toContain('is ambiguous');
        expect(result.references.every((r) => r.resolved)).toBe(false);
    });

    it('rejects an example tagged for an ambiguous tool', () => {
        const result = preprocessSkillMarkdown('```json tool=render\n{}\n```', ambiguous);
        expect(result.errors[0]).toContain('more than one provider defines');
    });
});

describe('fail-closed syntax handling', () => {
    it('reports an unterminated construct instead of leaking it to the model', () => {
        const result = preprocessSkillMarkdown('Use {@tool search_documents to search.', catalog);
        expect(result.errors[0]).toContain('malformed construct');
    });

    it('reports a tagged fence that is never closed', () => {
        const result = preprocessSkillMarkdown('```json tool=batch_execute\n{ "a": 1 }\n', catalog);
        expect(result.errors.some((e) => e.includes('is never closed'))).toBe(true);
    });

    it('rejects a fence carrying more than one tool= tag', () => {
        const result = preprocessSkillMarkdown('```json tool=batch_execute tool=fetch_document\n{}\n```', catalog);
        expect(result.errors[0]).toContain('2 tool= tags');
    });

    it('rejects a tool= tag on a fence that can never be validated', () => {
        const result = preprocessSkillMarkdown('```bash tool=batch_execute\necho hi\n```', catalog);
        expect(result.errors[0]).toContain("on a 'bash' fence");
    });

    it('captures a throwing validateExample rather than propagating it', () => {
        const result = preprocessSkillMarkdown('```json tool=batch_execute\n{}\n```', {
            ...catalog,
            validateExample: () => {
                throw new Error('validator exploded');
            },
        });
        expect(result.errors[0]).toContain('could not be validated: validator exploded');
    });
});

describe('createSchemaExampleValidator', () => {
    const FETCH = {
        name: 'fetch_document',
        params: {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id'],
            additionalProperties: false,
        },
    };
    const BATCH = {
        name: 'batch_execute',
        params: {
            type: 'object',
            properties: {
                tool_name: { type: 'string' },
                inputs: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: { id: { type: 'string' }, input: { type: 'object', additionalProperties: true } },
                    },
                },
            },
            additionalProperties: false,
        },
        dispatch: { field: 'tool_name', inputField: 'inputs[].input', deny: ['ask_user'] },
    };
    const validate = createSchemaExampleValidator([FETCH, BATCH, { name: 'ask_user', params: { type: 'object' } }]);

    it('accepts a valid payload', () => {
        expect(validate({ tool: 'fetch_document', value: { id: 'a' } })).toEqual([]);
    });

    /**
     * `allowed_tools` entries may carry the `+`/`-` selection prefixes, which the runtime strips
     * before resolving. Without the same courtesy here, the documented `+learn_x` form — the one
     * that keeps the default toolset — reads as a phantom tool.
     */
    describe('selection prefixes', () => {
        const LAUNCH = {
            name: 'launch_workstream',
            params: {
                type: 'object',
                properties: { allowed_tools: { type: 'array', items: { type: 'string' } } },
            },
            dispatch: { field: 'allowed_tools[]', stripsSelectionPrefix: true },
        };
        const strict = { ...LAUNCH, dispatch: { field: 'allowed_tools[]' } };

        it('resolves a prefixed name against the registry', () => {
            const validate = createSchemaExampleValidator([LAUNCH, FETCH]);

            expect(validate({ tool: 'launch_workstream', value: { allowed_tools: ['+fetch_document'] } })).toEqual([]);
        });

        it('still reports the name as written when it resolves to nothing', () => {
            const validate = createSchemaExampleValidator([LAUNCH]);
            const errors = validate({ tool: 'launch_workstream', value: { allowed_tools: ['+nope'] } });

            expect(errors).toEqual(["names '+nope', which is not a registered tool"]);
        });

        it('leaves the prefix in place for a dispatcher that does not strip it', () => {
            const validate = createSchemaExampleValidator([strict, FETCH]);
            const errors = validate({ tool: 'launch_workstream', value: { allowed_tools: ['+fetch_document'] } });

            expect(errors).toEqual(["names '+fetch_document', which is not a registered tool"]);
        });
    });

    /**
     * The failure a tag is supposed to make impossible, and the one it caused: a permissive schema
     * accepts another tool's payload, so the example reads as verified while nothing about it was.
     * A real `batch_execute` call sat under a `list_artifacts` tag exactly this way.
     */
    describe('binding', () => {
        const LIST = { name: 'list_artifacts', params: { type: 'object', properties: { prefix: { type: 'string' } } } };
        const bind = createSchemaExampleValidator([LIST, BATCH]);

        it('rejects a payload sharing no field with the tool it is tagged for', () => {
            const errors = bind({ tool: 'list_artifacts', value: { tool_name: 'x', inputs: [] } });

            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain("declares none of the payload's fields (tool_name, inputs)");
        });

        it('accepts any overlap, so an optional subset is not second-guessed', () => {
            expect(bind({ tool: 'list_artifacts', value: { prefix: 'files/' } })).toEqual([]);
        });

        it('stays quiet on an empty payload and on a schema that declares nothing', () => {
            const open = createSchemaExampleValidator([{ name: 'anything', params: { type: 'object' } }]);

            expect(bind({ tool: 'list_artifacts', value: {} })).toEqual([]);
            expect(open({ tool: 'anything', value: { whatever: 1 } })).toEqual([]);
        });
    });

    it('reports the offending key for an unexpected property', () => {
        const errors = validate({ tool: 'fetch_document', value: { document_id: 'a' } });
        expect(errors[0]).toContain("required property 'id'");
        expect(errors[0]).toContain("('document_id')");
    });

    it('resolves a dispatched name JSON Schema cannot judge', () => {
        expect(validate({ tool: 'batch_execute', value: { tool_name: 'ghost', inputs: [] } })[0]).toContain(
            'not a registered tool',
        );
        expect(validate({ tool: 'batch_execute', value: { tool_name: 'ask_user', inputs: [] } })[0]).toContain(
            'refuses at runtime',
        );
    });

    it('validates a forwarded input against the dispatched tool, not the dispatcher', () => {
        const errors = validate({
            tool: 'batch_execute',
            value: { tool_name: 'fetch_document', inputs: [{ id: 'a', input: { document_id: 'x' } }] },
        });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("forwards an input to 'fetch_document'");
    });

    it('accepts forwarded inputs that do satisfy the dispatched tool', () => {
        expect(
            validate({
                tool: 'batch_execute',
                value: { tool_name: 'fetch_document', inputs: [{ id: 'a', input: { id: 'x' } }] },
            }),
        ).toEqual([]);
    });
});

describe('unvalidatable tools', () => {
    it('rejects a tag for a tool whose schema the build cannot see', () => {
        const result = preprocessSkillMarkdown('```json tool=rss_reader\n{ "anything": true }\n```', {
            ...catalog,
            tools: new Set([...catalog.tools, 'rss_reader']),
            unvalidatableTools: new Set(['rss_reader']),
        });
        expect(result.errors[0]).toContain('cannot be verified');
    });

    it('still allows a plain {@tool} reference to such a tool', () => {
        const result = preprocessSkillMarkdown('Use {@tool rss_reader}.', {
            ...catalog,
            tools: new Set([...catalog.tools, 'rss_reader']),
            unvalidatableTools: new Set(['rss_reader']),
        });
        expect(result.errors).toEqual([]);
        expect(result.markdown).toBe('Use `rss_reader`.');
    });
});

describe('dispatch descriptor coherence', () => {
    const withDescriptor = (dispatch: { field: string; inputField?: string }) => [
        {
            name: 'batch_execute',
            params: { type: 'object', properties: { tool_name: { type: 'string' } } },
            dispatch,
        },
    ];

    it('fails closed on a field that does not exist', () => {
        expect(checkDispatchDescriptor(withDescriptor({ field: 'tool_nmae' })[0])[0]).toContain('does not exist');
    });

    it('fails closed on a field that cannot carry a tool name', () => {
        const tool = {
            name: 'batch_execute',
            params: { type: 'object', properties: { tool_name: { type: 'object' } } },
            dispatch: { field: 'tool_name' },
        };
        expect(checkDispatchDescriptor(tool)[0]).toContain('cannot carry a tool name');
    });

    it('fails closed on a missing inputField', () => {
        expect(
            checkDispatchDescriptor(withDescriptor({ field: 'tool_name', inputField: 'inputs[].input' })[0])[0],
        ).toContain("inputField 'inputs[].input' does not exist");
    });

    it('surfaces a broken descriptor through the example validator too', () => {
        const validate = createSchemaExampleValidator(withDescriptor({ field: 'tool_nmae' }));
        expect(validate({ tool: 'batch_execute', value: { tool_name: 'x' } })[0]).toContain('cannot be checked');
    });

    // A construct inside a fence is passed through unrendered and is not a reference either, so
    // nothing else would report it -- it simply reaches the model verbatim. Found by shipping one.
    it('reports a construct written inside a code fence', () => {
        const md = ['```yaml', '# see {@skill web_search} for details', '```'].join('\n');
        const result = preprocessSkillMarkdown(md, { tools: new Set(), skills: new Set(['web_search']) });

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('inside a code fence');
        expect(result.errors[0]).toContain('line 2');
        // Still passed through untouched: the fence body is never rewritten.
        expect(result.markdown).toContain('{@skill web_search}');
    });

    // Template syntax in fenced examples is not a construct: the renderer never sees fence bodies,
    // so flagging `{{@index}}` would reject documentation that was always correct.
    it('does not report template syntax inside a fence', () => {
        const md = ['```handlebars', '{{#each docs}}', '### Document {{@index}}', '{{/each}}', '```'].join('\n');
        const result = preprocessSkillMarkdown(md, { tools: new Set(), skills: new Set() });

        expect(result.errors).toEqual([]);
    });

    it('does not report constructs in prose next to a fence', () => {
        const md = ['See {@skill web_search}.', '', '```yaml', 'key: value', '```'].join('\n');
        const result = preprocessSkillMarkdown(md, { tools: new Set(), skills: new Set(['web_search']) });

        expect(result.errors).toEqual([]);
        expect(result.markdown).toContain('learn_web_search');
    });
});

/**
 * Field references. A skill saying a tool "takes `query` as an object" is asserting something
 * about that tool's schema, and it is the assertion that rots when a parameter is renamed.
 */
describe('field references', () => {
    const schema = {
        type: 'object',
        properties: {
            query: {
                type: 'object',
                properties: { full_text: { type: 'string' }, match: { type: 'object' } },
            },
            limit: { type: 'number' },
        },
    };
    const nested = {
        type: 'object',
        properties: {
            tool_name: { type: 'string' },
            inputs: {
                type: 'array',
                items: { type: 'object', properties: { id: { type: 'string' }, input: { type: 'object' } } },
            },
        },
    };
    const options = {
        ...catalog,
        validateField: createSchemaFieldValidator([
            { name: 'search_documents', params: schema },
            { name: 'batch_execute', params: nested },
            { name: 'fetch_document' },
        ]),
    };

    it('renders the path alone and records the tool it belongs to', () => {
        const result = preprocessSkillMarkdown(
            '{@tool search_documents} takes {@param search_documents.query}.',
            options,
        );

        expect(result.markdown).toBe('`search_documents` takes `query`.');
        expect(result.errors).toEqual([]);
        expect(result.references[1]).toEqual({
            kind: 'param',
            name: 'search_documents',
            path: 'query',
            rendered: '`query`',
            line: 1,
            resolved: true,
        });
    });

    it('walks nested and array segments', () => {
        const result = preprocessSkillMarkdown(
            'Each {@param batch_execute.inputs[].id} labels an {@param batch_execute.inputs[].input}.',
            options,
        );

        expect(result.errors).toEqual([]);
        expect(result.markdown).toBe('Each `inputs[].id` labels an `inputs[].input`.');
    });

    it('reports a field the schema does not declare, listing what it does', () => {
        const result = preprocessSkillMarkdown('Pass {@param search_documents.text}.', options);

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain("names 'text', which 'search_documents' does not declare");
        expect(result.errors[0]).toContain('declared: limit, query');
        expect(result.references[0].resolved).toBe(false);
    });

    it('names the level a nested field is missing from', () => {
        const result = preprocessSkillMarkdown('Pass {@param search_documents.query.exact}.', options);

        expect(result.errors[0]).toContain("names 'exact', which 'query' of 'search_documents' does not declare");
        expect(result.errors[0]).toContain('declared: full_text, match');
    });

    it('rejects a field on a tool no provider registers', () => {
        const result = preprocessSkillMarkdown('Pass {@param ghost_tool.query}.', options);

        expect(result.errors).toEqual(["line 1: '{@param ghost_tool.query}' refers to a tool no provider registers"]);
    });

    it('fails closed on a tool whose schema this build cannot see', () => {
        const result = preprocessSkillMarkdown('Pass {@param fetch_document.id}.', options);

        expect(result.errors[0]).toContain("cannot be checked: 'fetch_document' exposes no schema");
    });

    it('rejects a reference with no field path', () => {
        const result = preprocessSkillMarkdown('Pass {@param search_documents}.', options);

        expect(result.errors[0]).toContain('must be written {@param tool.field}');
        // Left verbatim, so the author sees what they wrote.
        expect(result.markdown).toBe('Pass {@param search_documents}.');
    });

    // The construct exists only to be checked; a catalog without a validator would turn every
    // {@param …} in the tree into decoration, and nothing else would report it.
    it('rejects the construct when the catalog supplies no field validator', () => {
        const result = preprocessSkillMarkdown('Pass {@param search_documents.anything}.', catalog);

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('supplies no validateField');
        expect(result.markdown).toBe('Pass `anything`.');
    });

    // The preprocessor resolves the name against `tools` first, so reaching the validator with an
    // unknown name means the catalog's names and its schema entries disagree. Passing there would
    // silently exempt a whole provider -- every apps/tools local tool, in practice.
    it('reports a tool that the catalog names but supplies no entry for', () => {
        const result = preprocessSkillMarkdown('Pass {@param batch_execute.tool_name}.', {
            ...catalog,
            validateField: createSchemaFieldValidator([{ name: 'search_documents', params: schema }]),
        });

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain("'batch_execute' is absent from this build's schema entries");
    });

    describe('references', () => {
        const withDefs = {
            type: 'object',
            properties: {
                // A whole embedded resource, as create_view.configuration is: its own $id and
                // $defs, so `#/$defs/…` inside it means *its* definitions, not the tool's.
                configuration: {
                    $id: 'https://schemas.vertesia.com/view.v1.schema.json',
                    type: 'object',
                    properties: { layout: { $ref: '#/$defs/layout' } },
                    $defs: {
                        layout: { type: 'object', properties: { mode: { type: 'string' } } },
                    },
                },
                broken: { $ref: 'https://example.com/other.schema.json#/$defs/thing' },
                node: { $ref: '#/$defs/node' },
            },
            $defs: {
                node: {
                    type: 'object',
                    properties: { label: { type: 'string' }, child: { $ref: '#/$defs/node' } },
                },
            },
        };
        const refs = {
            ...catalog,
            validateField: createSchemaFieldValidator([{ name: 'search_documents', params: withDefs }]),
        };

        it('resolves a field behind a local $ref, against the innermost resource', () => {
            const result = preprocessSkillMarkdown('Set {@param search_documents.configuration.layout.mode}.', refs);

            expect(result.errors).toEqual([]);
            expect(result.markdown).toBe('Set `configuration.layout.mode`.');
        });

        it('reports an unresolvable reference as uncheckable, not as a missing field', () => {
            const result = preprocessSkillMarkdown('Set {@param search_documents.broken.thing}.', refs);

            expect(result.errors[0]).toContain('unresolvable reference');
            expect(result.errors[0]).toContain('https://example.com/other.schema.json');
            expect(result.errors[0]).not.toContain('does not declare');
        });

        it('terminates on a recursive $ref', () => {
            const good = preprocessSkillMarkdown('{@param search_documents.node.child.label}', refs);
            expect(good.errors).toEqual([]);

            const bad = preprocessSkillMarkdown('{@param search_documents.node.child.ghost}', refs);
            expect(bad.errors[0]).toContain('does not declare');
        });
    });

    it('resolves a field declared only inside a composition branch', () => {
        const composed = createSchemaFieldValidator([
            {
                name: 'search_documents',
                params: {
                    type: 'object',
                    properties: {
                        query: { anyOf: [{ type: 'string' }, { properties: { full_text: { type: 'string' } } }] },
                    },
                },
            },
        ]);
        const result = preprocessSkillMarkdown('Pass {@param search_documents.query.full_text}.', {
            ...catalog,
            validateField: composed,
        });

        expect(result.errors).toEqual([]);
    });
});
