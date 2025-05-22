import { describe, expect, test } from "vitest";
import { ObjectWalker, AsyncObjectWalker } from "./walk.js";

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
            onValue(key, value) {
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
        });
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
        });
        expect(r.length).toBe(4);
        expect(r[0]).toBe("123");
        expect(r[1].x).toBe("1");
        expect(r[2].y).toBe("2");
        expect(r[3].z).toBe("3");
    })

    test('async map', async () => {
        const obj = { ar: [123, { x: 1 }, { y: { a: 1, b: [2] } }] };
        const r: any = await new AsyncObjectWalker().map(obj, async (_key, value) => {
            if (typeof value === "number") {
                return new Promise((resolve) => {
                    return setTimeout(() => {
                        resolve(String(value));
                    }, 50);
                });
            }
            return value;
        });
        expect(Array.isArray(r.ar)).toBe(true);
        expect(r.ar.length).toBe(obj.ar.length);
        expect(r.ar[0]).toBe("123");
        expect(r.ar[1].x).toBe("1");
        const y: any = r.ar[2].y;
        expect(y.a).toBe("1");
        console.log(y.b);
        expect(Array.isArray(y.b)).toBe(true);
        expect(y.b.length).toBe(1);
        expect(y.b[0]).toBe("2");
    })

})