import type { DSLWorkflowSpec } from '@vertesia/common';
import { describe, expect, test, vi } from 'vitest';
import { getWorkflowErrors, ValidationError, validateWorkflow } from './validation.js';

describe('workflow validation', () => {
    test('should reject an empty object as a workflow', () => {
        const workflow = {};
        const errors = getWorkflowErrors(workflow as unknown as DSLWorkflowSpec);
        expect(errors.length).toBe(2);
    });

    test('should require activities', () => {
        const workflow = {
            name: 'test',
        };
        const errors = getWorkflowErrors(workflow as unknown as DSLWorkflowSpec);
        expect(errors.length).toBe(1);
    });

    test('should require activities to be an array', () => {
        const workflow = {
            name: 'test',
            activities: {},
        };
        const errors = getWorkflowErrors(workflow as unknown as DSLWorkflowSpec);
        expect(errors.length).toBe(1);
    });

    test('should require activities array to have at least one item', () => {
        const workflow = {
            name: 'test',
            activities: [],
        };
        const errors = getWorkflowErrors(workflow as unknown as DSLWorkflowSpec);
        expect(errors.length).toBe(1);
    });

    test('should require activity to have a name', () => {
        const workflow = {
            name: 'test',
            activities: [{}],
        };
        const errors = getWorkflowErrors(workflow as unknown as DSLWorkflowSpec);
        expect(errors.length).toBe(1);
    });

    test('should allow empty activity', () => {
        const workflow = {
            name: 'test',
            activities: [{ name: 'test' }],
        };
        const errors = getWorkflowErrors(workflow as unknown as DSLWorkflowSpec);
        expect(errors.length).toBe(0);
    });

    test('should reject imported undeclared vars', () => {
        const workflow = {
            name: 'test',
            vars: { foo: true },
            activities: [
                {
                    name: 'test',
                    import: ['foo', 'bar'],
                },
            ],
        };
        const errors = getWorkflowErrors(workflow as unknown as DSLWorkflowSpec);
        expect(errors.length).toBe(1);
    });

    test('should allow importing declared vars', () => {
        const workflow = {
            name: 'test',
            vars: { foo: true, bar: true },
            activities: [
                {
                    name: 'test',
                    import: ['foo', 'bar'],
                },
            ],
        };
        const errors = getWorkflowErrors(workflow as unknown as DSLWorkflowSpec);
        expect(errors.length).toBe(0);
    });

    test('should reject unknown imported vars through expressions', () => {
        const workflow = {
            name: 'test',
            vars: { foo: true },
            activities: [
                {
                    name: 'test',
                    import: [{ foo: 'foo', barLen: 'bar.length' }],
                },
            ],
        };
        const errors = getWorkflowErrors(workflow as unknown as DSLWorkflowSpec);
        expect(errors.length).toBe(1);
    });

    test('should allow declared vars through expressions', () => {
        const workflow = {
            name: 'test',
            vars: { foo: true, bar: 'true' },
            activities: [
                {
                    name: 'test',
                    import: [{ foo: 'foo', barLen: 'bar.length' }],
                },
            ],
        };
        const errors = getWorkflowErrors(workflow as unknown as DSLWorkflowSpec);
        expect(errors.length).toBe(0);
    });

    test('should detect self references', () => {
        const workflow = {
            name: 'test',
            vars: { object_type: 'thetype' },
            activities: [
                {
                    name: 'test',
                    import: ['object_type'],
                    params: {
                        object_type: '${object_type}',
                    },
                },
            ],
        };
        const errors = getWorkflowErrors(workflow as unknown as DSLWorkflowSpec);
        expect(errors.length).toBe(1);
        expect(errors[0].includes('Self referencing parameter')).toBe(true);
    });

    test('should allow known vars in fetch', () => {
        const workflow = {
            name: 'test',
            vars: { foo: true, bar: 'true' },
            activities: [
                {
                    name: 'test',
                    import: [{ foo: 'foo', barLen: 'bar.length' }],
                    fetch: {
                        doc: {
                            query: {
                                foo: '${foo}',
                                barLen: '${barLen}',
                            },
                        },
                    },
                },
            ],
        };
        const errors = getWorkflowErrors(workflow as unknown as DSLWorkflowSpec);

        expect(errors.length).toBe(0);
    });

    test('should reject unknown vars in fetch', () => {
        const workflow = {
            name: 'test',
            vars: { foo: true, bar: 'true' },
            activities: [
                {
                    name: 'test',
                    import: [],
                    fetch: {
                        doc: {
                            query: {
                                foo: '${foo}',
                                barLen: '${barLen}',
                            },
                        },
                    },
                },
            ],
        };
        const errors = getWorkflowErrors(workflow as unknown as DSLWorkflowSpec);
        expect(errors.length).toBe(2);
    });

    test('should reject one unknown var in fetch while allowing known vars', () => {
        const workflow = {
            name: 'test',
            vars: { foo: true, bar: 'true' },
            activities: [
                {
                    name: 'test',
                    import: ['foo'],
                    fetch: {
                        doc: {
                            query: {
                                foo: '${foo}',
                                barLen: '${barLen}',
                            },
                        },
                    },
                },
            ],
        };
        const errors = getWorkflowErrors(workflow as unknown as DSLWorkflowSpec);
        expect(errors.length).toBe(1);
    });

    test('should reject two unknown vars in params', () => {
        const workflow = {
            name: 'test',
            vars: { foo: true, bar: 'true' },
            activities: [
                {
                    name: 'test',
                    import: ['foo'],
                    params: {
                        barLength: '${barLen}',
                        doc: '${doc.text}',
                    },
                },
            ],
        };
        const errors = getWorkflowErrors(workflow as unknown as DSLWorkflowSpec);
        expect(errors.length).toBe(2);
    });

    test('should reject one unknown var in params', () => {
        const workflow = {
            name: 'test',
            vars: { foo: true, bar: 'true' },
            activities: [
                {
                    name: 'test',
                    import: ['foo', { barLen: 'bar.length' }],
                    params: {
                        barLength: '${barLen}',
                        doc: '${doc.text}',
                    },
                },
            ],
        };
        const errors = getWorkflowErrors(workflow as unknown as DSLWorkflowSpec);
        expect(errors.length).toBe(1);
    });

    test('should allow known vars in params', () => {
        const workflow = {
            name: 'test',
            vars: { foo: true, bar: 'true' },
            activities: [
                {
                    name: 'test0',
                    output: 'previousResult',
                },
                {
                    name: 'test',
                    import: ['foo', { barLen: 'bar.length' }, 'previousResult'],
                    fetch: {
                        doc: {
                            query: {
                                foo: '${foo}',
                                barLen: '${barLen}',
                            },
                        },
                    },
                    params: {
                        fooParam: '${foo}',
                        barLenParam: '${barLen}',
                        doc: '${doc.text}',
                        prev: '${previousResult}',
                    },
                },
            ],
        };
        const errors = getWorkflowErrors(workflow as unknown as DSLWorkflowSpec);
        expect(errors.length).toBe(0);
    });

    test('should reject a misspelled var in params', () => {
        const workflow = {
            name: 'test',
            vars: { language: 'fr' },
            steps: [
                {
                    type: 'activity',
                    name: 'translate',
                    import: ['language'],
                    params: { target: 'Translate to ${langauge}' },
                },
            ],
        };
        const errors = getWorkflowErrors(workflow as unknown as DSLWorkflowSpec);
        expect(errors).toEqual(['Activity "translate": Unknown variable "langauge" in expression "${langauge}"']);
    });

    test('should check references nested in arrays and objects, ignoring fallbacks', () => {
        const workflow = {
            name: 'test',
            activities: [
                {
                    name: 'test',
                    import: ['objectId'],
                    params: {
                        list: ['${objectId}', { deep: '${missing ?? "x"}' }],
                        index: '${objectId[0].name}',
                    },
                },
            ],
        };
        const errors = getWorkflowErrors(workflow as unknown as DSLWorkflowSpec);
        expect(errors).toEqual(['Activity "test": Unknown variable "missing" in expression "${missing}"']);
    });
});

describe('runtime expression rules', () => {
    function errorsFor(activity: Record<string, unknown>, vars: Record<string, unknown> = { field: 1 }) {
        return getWorkflowErrors({ name: 'test', vars, activities: [{ name: 'a', ...activity }] } as DSLWorkflowSpec);
    }

    test('should accept required imports', () => {
        expect(
            errorsFor({ import: ['objectId!', { f: 'field!' }], params: { id: '${objectId}', value: '${f}' } }),
        ).toEqual([]);
    });

    test('should reject an unknown required import', () => {
        expect(errorsFor({ import: ['missing!'] })).toEqual([
            'Activity "a": Unknown workflow variable "missing!" in import declaration',
        ]);
    });

    test('should accept JSON and single-quoted fallbacks', () => {
        expect(
            errorsFor({
                import: ['field'],
                params: { a: '${field ?? 1}', b: "${field ?? 'x'}", c: '${ field ?? "y" }', d: '${field??null}' },
            }),
        ).toEqual([]);
    });

    test('should reject a fallback the runtime cannot parse', () => {
        expect(errorsFor({ import: ['field'], params: { a: '${field ?? nope}' } })).toEqual([
            'Activity "a": Invalid fallback value "nope" in reference "${field ?? nope}" in expression "${field ?? nope}"',
        ]);
    });

    test('should not trim a reference without a fallback', () => {
        expect(errorsFor({ import: ['field'], params: { a: '${ field }' } })).toEqual([
            'Activity "a": Unknown variable " field " in expression "${ field }"',
        ]);
    });

    test('should reject an invalid variable path', () => {
        expect(errorsFor({ import: ['field'], params: { a: '${field..x}' } })).toEqual([
            'Activity "a": Invalid variable reference "field..x" in expression "${field..x}"',
        ]);
    });
});

describe('validateWorkflow', () => {
    test('should throw a ValidationError for an invalid workflow', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        try {
            expect(() => validateWorkflow({ name: 'test' } as unknown as DSLWorkflowSpec)).toThrow(ValidationError);
        } finally {
            log.mockRestore();
        }
    });

    test('should return a valid workflow unchanged', () => {
        const workflow = { name: 'test', activities: [{ name: 'test' }] } as unknown as DSLWorkflowSpec;
        expect(validateWorkflow(workflow)).toBe(workflow);
    });
});
