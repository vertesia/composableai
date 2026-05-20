import { describe, expect, test } from "vitest";
import { ObjectWalker } from "./walk.js";

/** Permissive recursive type for navigating untyped walker results in test assertions. */
type Tree = { readonly [key: string]: Tree };

describe('walk object', () => {

    test('find string values', () => {
        const obj = {
            name: "foo",
            age: 42,
            children: [{
                name: "bar",
                age: 12,
            },
            {
                name: "baz",
                age: 15,
            }],
            folder: {
                subfolder: {
                    name: "file",
                }
            }
        }
        const values = ["foo", "bar", "baz", "file"].sort().join(',');
        const found: string[] = [];
        new ObjectWalker().walk(obj, {
            onValue(_key, value) {
                if (typeof value === "string") {
                    found.push(value);
                }
            }
        })
        expect(found.sort().join(',')).toBe(values);
    })

    test('map numbers to string values', () => {
        const obj = {
            name: "foo",
            age: 42,
            children: [{
                name: "bar",
                age: 12,
            },
            {
                name: "baz",
                age: 15,
            }],
            folder: {
                subfolder: {
                    name: 123,
                }
            }
        }
        const r = new ObjectWalker().map(obj, (_key, value) => {
            if (typeof value === "number") {
                return String(value)
            }
            return value;
        }) as Tree;
        expect(r.age).toBe("42");
        expect(r.children[0].age).toBe("12");
        expect(r.children[1].age).toBe("15");
        expect(r.folder.subfolder.name).toBe("123");
    })

    test('map numbers in an array to string values', () => {
        const obj = [123, { x: 1 }, { y: 2 }, { z: 3 }]
        const r = new ObjectWalker().map(obj, (_key, value) => {
            if (typeof value === "number") {
                return String(value)
            }
            return value;
        }) as unknown as Tree;
        expect(r.length).toBe(4);
        expect(r[0]).toBe("123");
        expect(r[1].x).toBe("1");
        expect(r[2].y).toBe("2");
        expect(r[3].z).toBe("3");
    })

})