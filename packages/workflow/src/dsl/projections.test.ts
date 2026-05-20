import { describe, test, expect } from "vitest";
import { makeProjection } from "./projections.js";

describe('Result Projections', () => {

    test('simple projection', () => {
        const params: Record<string, unknown> = {
            docTypes: [{ id: 1, name: "type1" }, { id: 2, name: "type2" }],
            objectId: "123"
        }
        const result = {
            result: {
                document_type: "C",
            }
        }
        const spec = {
            docType: "${docTypes[0].name}",
            objectId: "${objectId}",
            resultType: "${#.result.document_type}",
            timestamp: 123456
        }
        const out = makeProjection(spec, params, result);

        expect(Object.keys(out).length).toBe(4);
        expect(out.docType).toBe("type1");
        expect(out.objectId).toBe("123");
        expect(out.resultType).toBe("C");
        expect(out.timestamp).toBe(123456);
        expect(out.foo).toBeUndefined();
    })

    test('$element match', () => {
        const params: Record<string, unknown> = {
            docTypes: [{ id: 1, name: "type1" }, { id: 2, name: "type2" }],
            objectId: "123"
        }
        const result = {
            result: {
                document_type: "type2",
            }
        }
        const spec = {
            docType: {
                $element: {
                    from: "${docTypes}",
                    where: { name: { $eq: "${#.result.document_type}" } },
                    else: { id: 0, name: "unknown" }
                }
            },
            isNewType: {
                $eval: {
                    "#.result.document_type": { $nin: "${docTypes.name}" }
                }
            }
        }

        const out = makeProjection(spec, params, result);


        expect(Object.keys(out).length).toBe(2);
        expect(out.docType).toStrictEqual({ id: 2, name: "type2" });
        expect(out.isNewType).toBe(false);
    })

    test('$element does not match', () => {
        const params: Record<string, unknown> = {
            docTypes: [{ id: 1, name: "type1" }, { id: 2, name: "type2" }],
            objectId: "123"
        }
        const result = {
            result: {
                document_type: "a_new_type",
            }
        }
        const projection = {
            docType: {
                $element: {
                    from: "${docTypes}",
                    where: { name: { $eq: "${#.result.document_type}" } },
                    else: { id: 0, name: "${#.result.document_type}" }
                }
            },
            isNewType: {
                $eval: {
                    "#.result.document_type": { $nin: "${docTypes.name}" }
                }
            }
        }

        const out = makeProjection(projection, params, result);


        expect(Object.keys(out).length).toBe(2);
        expect(out.docType).toStrictEqual({ id: 0, name: "a_new_type" });
        expect(out.isNewType).toBe(true);
    })

    test('$element with field', () => {
        const params: Record<string, unknown> = {
            docTypes: [{ id: 1, name: "type1" }, { id: 2, name: "type2" }],
            objectId: "123"
        }
        const result = {
            result: {
                document_type: "type2",
            }
        }
        const projection = {
            other: null,
            name: "${#.result.document_type}",
            id: {
                $element: {
                    field: "id",
                    from: "${docTypes}",
                    where: { name: { $eq: "${#.result.document_type}" } },
                    else: null
                }
            },
        }

        const out = makeProjection(projection, params, result);


        expect(Object.keys(out).length).toBe(3);
        expect(out).toStrictEqual({ id: 2, name: "type2", other: null });
    })

    test('$element with field - no match', () => {
        const params: Record<string, unknown> = {
            docTypes: [{ id: 1, name: "type1" }, { id: 2, name: "type2" }],
            objectId: "123"
        }
        const result = {
            result: {
                document_type: "a_new_type",
            }
        }
        const projection = {
            other: null,
            name: "${#.result.document_type}",
            id: {
                $element: {
                    field: "id",
                    from: "${docTypes}",
                    where: { name: { $eq: "${#.result.document_type}" } },
                    else: null
                }
            },
        }

        const out = makeProjection(projection, params, result);


        expect(Object.keys(out).length).toBe(3);
        expect(out).toStrictEqual({ id: null, name: "a_new_type", other: null });
    })

});
