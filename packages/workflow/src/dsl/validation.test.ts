import type { DSLWorkflowSpec } from '@vertesia/common';
import { describe, expect, test } from 'vitest';
import { validateWorkflow } from './validation.js';

describe('workflow validation', () => {
    test('should reject an empty object as a workflow', () => {
        const workflow = {};
        const errors = validateWorkflow(workflow as unknown as DSLWorkflowSpec);
        expect(errors.length).toBe(2);
    });

    test('should require activities', () => {
        const workflow = {
            name: 'test',
        };
        const errors = validateWorkflow(workflow as unknown as DSLWorkflowSpec);
        expect(errors.length).toBe(1);
    });

    test('should require activities to be an array', () => {
        const workflow = {
            name: 'test',
            activities: {},
        };
        const errors = validateWorkflow(workflow as unknown as DSLWorkflowSpec);
        expect(errors.length).toBe(1);
    });

    test('should require activities array to have at least one item', () => {
        const workflow = {
            name: 'test',
            activities: [],
        };
        const errors = validateWorkflow(workflow as unknown as DSLWorkflowSpec);
        expect(errors.length).toBe(1);
    });

    test('should require activity to have a name', () => {
        const workflow = {
            name: 'test',
            activities: [{}],
        };
        const errors = validateWorkflow(workflow as unknown as DSLWorkflowSpec);
        expect(errors.length).toBe(1);
    });

    test('should allow empty activity', () => {
        const workflow = {
            name: 'test',
            activities: [{ name: 'test' }],
        };
        const errors = validateWorkflow(workflow as unknown as DSLWorkflowSpec);
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
        const errors = validateWorkflow(workflow as unknown as DSLWorkflowSpec);
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
        const errors = validateWorkflow(workflow as unknown as DSLWorkflowSpec);
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
        const errors = validateWorkflow(workflow as unknown as DSLWorkflowSpec);
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
        const errors = validateWorkflow(workflow as unknown as DSLWorkflowSpec);
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
        const errors = validateWorkflow(workflow as unknown as DSLWorkflowSpec);
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
        const errors = validateWorkflow(workflow as unknown as DSLWorkflowSpec);
        console.log('##############errors', errors);

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
        const errors = validateWorkflow(workflow as unknown as DSLWorkflowSpec);
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
        const errors = validateWorkflow(workflow as unknown as DSLWorkflowSpec);
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
        const errors = validateWorkflow(workflow as unknown as DSLWorkflowSpec);
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
        const errors = validateWorkflow(workflow as unknown as DSLWorkflowSpec);
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
        const errors = validateWorkflow(workflow as unknown as DSLWorkflowSpec);
        expect(errors.length).toBe(0);
    });
});
