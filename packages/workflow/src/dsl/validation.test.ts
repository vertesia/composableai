import { describe, expect, test } from "vitest";
import { validateWorkflow } from "./validation.ts";

describe('workflow validation', () => {

    test('empty object is not a valid workflow', () => {
        const workflow: any = {
        }
        const errors = validateWorkflow(workflow);
        expect(errors.length).toBe(2);
    })

    test('activities is required', () => {
        const workflow: any = {
            name: "test",
        }
        const errors = validateWorkflow(workflow);
        expect(errors.length).toBe(1);
    })

    test('activities should be an array', () => {
        const workflow: any = {
            name: "test",
            activities: {}
        }
        const errors = validateWorkflow(workflow);
        expect(errors.length).toBe(1);
    })

    test('activities array should have at least one item', () => {
        const workflow: any = {
            name: "test",
            activities: []
        }
        const errors = validateWorkflow(workflow);
        expect(errors.length).toBe(1);
    })

    test('activity should have a name', () => {
        const workflow: any = {
            name: "test",
            activities: [{}]
        }
        const errors = validateWorkflow(workflow);
        expect(errors.length).toBe(1);
    })

    test('allow empty activity', () => {
        const workflow: any = {
            name: "test",
            activities: [{ name: "test" }]
        }
        const errors = validateWorkflow(workflow);
        expect(errors.length).toBe(0);
    })

    test('import undeclared var', () => {
        const workflow: any = {
            name: "test",
            vars: { "foo": true },
            activities: [{
                name: "test",
                import: ["foo", "bar"]
            }]
        }
        const errors = validateWorkflow(workflow);
        expect(errors.length).toBe(1);
    })


    test('import declared vars', () => {
        const workflow: any = {
            name: "test",
            vars: { "foo": true, "bar": true },
            activities: [{
                name: "test",
                import: ["foo", "bar"]
            }]
        }
        const errors = validateWorkflow(workflow);
        expect(errors.length).toBe(0);
    })

    test('import unknown imported var through expressions', () => {
        const workflow: any = {
            name: "test",
            vars: { "foo": true },
            activities: [{
                name: "test",
                import: [{ "foo": "foo", "barLen": "bar.length" }]
            }]
        }
        const errors = validateWorkflow(workflow);
        expect(errors.length).toBe(1);
    })

    test('import declared vars through expressions', () => {
        const workflow: any = {
            name: "test",
            vars: { "foo": true, "bar": "true" },
            activities: [{
                name: "test",
                import: [{ "foo": "foo", "barLen": "bar.length" }]
            }]
        }
        const errors = validateWorkflow(workflow);
        expect(errors.length).toBe(0);
    })

    test('detect self references', () => {
        const workflow: any = {
            name: "test",
            vars: { "object_type": "thetype" },
            activities: [{
                name: "test",
                import: ["object_type"],
                params: {
                    "object_type": "${object_type}"
                }
            }]
        }
        const errors = validateWorkflow(workflow);
        expect(errors.length).toBe(1);
        expect(errors[0].includes("Self referencing parameter")).toBe(true);
    })

    test('reference known vars in fetch', () => {
        const workflow: any = {
            name: "test",
            vars: { "foo": true, "bar": "true" },
            activities: [{
                name: "test",
                import: [{ "foo": "foo", "barLen": "bar.length" }],
                fetch: {
                    doc: {
                        query: {
                            foo: "${foo}",
                            barLen: "${barLen}"
                        }
                    }
                }
            }]
        }
        const errors = validateWorkflow(workflow);
        console.log('##############errors', errors);

        expect(errors.length).toBe(0);
    })

    test('reference unknown vars in fetch', () => {
        const workflow: any = {
            name: "test",
            vars: { "foo": true, "bar": "true" },
            activities: [{
                name: "test",
                import: [],
                fetch: {
                    doc: {
                        query: {
                            foo: "${foo}",
                            barLen: "${barLen}"
                        }
                    }
                }
            }]
        }
        const errors = validateWorkflow(workflow);
        expect(errors.length).toBe(2);
    })

    test('reference one unknown and one known var in fetch', () => {
        const workflow: any = {
            name: "test",
            vars: { "foo": true, "bar": "true" },
            activities: [{
                name: "test",
                import: ["foo"],
                fetch: {
                    doc: {
                        query: {
                            foo: "${foo}",
                            barLen: "${barLen}"
                        }
                    }
                }
            }]
        }
        const errors = validateWorkflow(workflow);
        expect(errors.length).toBe(1);
    })

    test('reference 2 unknown vars in params', () => {
        const workflow: any = {
            name: "test",
            vars: { "foo": true, "bar": "true" },
            activities: [{
                name: "test",
                import: ["foo"],
                params: {
                    barLength: "${barLen}",
                    doc: "${doc.text}"
                }
            }]
        }
        const errors = validateWorkflow(workflow);
        expect(errors.length).toBe(2);
    })

    test('reference 1 unknown vars in params', () => {
        const workflow: any = {
            name: "test",
            vars: { "foo": true, "bar": "true" },
            activities: [{
                name: "test",
                import: ["foo", { "barLen": "bar.length" }],
                params: {
                    barLength: "${barLen}",
                    doc: "${doc.text}"
                }
            }]
        }
        const errors = validateWorkflow(workflow);
        expect(errors.length).toBe(1);
    })

    test('reference known vars in params', () => {
        const workflow: any = {
            name: "test",
            vars: { "foo": true, "bar": "true" },
            activities: [
                {
                    name: "test0",
                    output: "previousResult"
                }, {
                    name: "test",
                    import: ["foo", { "barLen": "bar.length" }, "previousResult"],
                    fetch: {
                        doc: {
                            query: {
                                foo: "${foo}",
                                barLen: "${barLen}"
                            }
                        }
                    },
                    params: {
                        fooParam: "${foo}",
                        barLenParam: "${barLen}",
                        doc: "${doc.text}",
                        prev: "${previousResult}"
                    }
                }]
        }
        const errors = validateWorkflow(workflow);
        expect(errors.length).toBe(0);
    })

})