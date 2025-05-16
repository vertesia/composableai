import { describe, expect, test } from "vitest";
import { Vars } from "./vars.ts";

describe('Workflow vars', () => {

    test('access initial variables', () => {
        const vars = new Vars({
            objectId: "123",
            timestamp: 123456,
        });
        expect(vars.getValue("objectId")).toBe("123");
        expect(vars.getValue("timestamp")).toBe(123456);
        expect(vars.getValue("foo")).toBeUndefined();
    })

    test('set and access variables', () => {
        const vars = new Vars({
            objectId: "123",
            timestamp: 123456,
        });
        expect(vars.getValue("objectId")).toBe("123");
        vars.setValue("objectId", "456");
        expect(vars.getValue("objectId")).toBe("456");
    })

    test('access and modify ref variables', () => {
        const vars = new Vars({
            objectId: "123",
            config: {
                name: "foo",
            },
            objectIdAlias: "${objectId}",
            configNameAlias: "${config.name}",
        });
        expect(vars.getValue("objectIdAlias")).toBe("123");
        expect(vars.getValue("configNameAlias")).toBe("foo");
        vars.setValue("objectId", "456");
        vars.getValue("config").name = "bar";
        expect(vars.getValue("objectIdAlias")).toBe("456");
        expect(vars.getValue("configNameAlias")).toBe("bar");
    })

    test('replace literal with ref', () => {
        const vars = new Vars({
            objectId: "123",
            otherId: "1234",
        });
        expect(vars.getValue("objectId")).toBe("123");
        expect(vars.getValue("otherId")).toBe("1234");
        vars.setValue("objectId", "456");
        vars.load({ "otherId": "${objectId}" });
        expect(vars.getValue("objectId")).toBe("456");
        expect(vars.getValue("otherId")).toBe("456");
    });

    test("undefined ref variable", () => {
        const vars = new Vars({
            otherId: "${objectId}",
        });
        expect(vars.getValue("otherId")).toBeUndefined();
    })

    test("default values", () => {
        const vars = new Vars({
            squote: "${objectId ?? '123'}",
            dquote: "${objectId ?? \"123\"}",
            number: "${objectId ?? 123}",
            boolean: "${objectId ?? true}",
            array: "${objectId ?? [1,2]}",
        });
        // object valus and path expression are not supported
        expect(vars.getValue("squote")).toBe("123");
        expect(vars.getValue("dquote")).toBe("123");
        expect(vars.getValue("number")).toBe(123);
        expect(vars.getValue("boolean")).toBe(true);
        expect(vars.getValue("array")).toEqual([1, 2]);
    })

    test("array map", () => {
        const vars = new Vars({
            docs: [{ text: "hello" }, { text: "world" }],
        });
        // object valus and path expression are not supported
        expect(vars.getValue("docs.text").join(' ')).toBe("hello world");
    })

    test("resolveParams", () => {
        const vars = new Vars({
            objectIds: ["123", "456"],
            objectId: "123",
            data: { message: "hello" },
        });
        const params = {
            query: {
                _id: "${objectId}",
                data: "${data}",
            },
            secondDocId: "${objectIds.1}",
            secondDocIdByBracket: "${objectIds[1]}",
        }
        const resolved = vars.resolveParams(params);
        expect(Object.keys(resolved).length).toBe(3);
        expect(resolved.query).toBeTypeOf("object");
        expect(resolved.query._id).toBe("123");
        expect(resolved.query.data).toBeTypeOf("object");
        expect(resolved.query.data.message).toBe("hello");
        expect(resolved.secondDocId).toBe("456");
        expect(resolved.secondDocIdByBracket).toBe("456");

    });

    test("resolve", () => {
        const vars = new Vars({
            objectId: "123",
            message: "hello",
            prompt_data: { message: "${message}" },
            data2: "${prompt_data}",
            unknown: "${notdefined}"
        });
        const resolved = vars.resolve();
        console.log('@@@@@@@@@@@@@@@@@@@', resolved);
        expect(Object.keys(resolved).length).toBe(4); // since unknown will be undefined it will not be included
        expect(resolved.objectId).toBe("123");
        expect(resolved.prompt_data).toBeTypeOf("object");
        expect(resolved.prompt_data.message).toBe("hello");
        expect(resolved.data2).toBeTypeOf("object");
        expect(resolved.data2.message).toBe("hello");
        expect(resolved.unknown).toBeUndefined();
    });


    test("createImportVars", () => {
        const vars = new Vars({
            person: { name: "John", age: 30 },
            objectId: "123",
            data: { message: "hello" },
            data2: "${data}",
        });
        const params = vars.createImportVars(["data2", { "name": "person.name", "age": "person.age" }, { message: "data.message" }]);
        expect(Object.keys(params).length).toBe(4);
        expect(params.name).toBe("John");
        expect(params.age).toBe(30);
        expect(params.message).toBe("hello");
        expect(params.data2).toStrictEqual({ message: "hello" });
    });

    test("evaluate null and exists conditions", () => {
        const vars = new Vars({
            objectId: "123",
            docType: {
                id: "bla",
                idNull: null,
            }
        });
        expect(vars.match({ objectId: { $exists: true } })).toBe(true);
        expect(vars.match({ objectId: { $exists: false } })).toBe(false);
        expect(vars.match({ objectIds: { $exists: true } })).toBe(false);
        expect(vars.match({ objectIds: { $exists: false } })).toBe(true);
        expect(vars.match({ "docType.id": { $exists: true } })).toBe(true);
        expect(vars.match({ "docType.idNull": { $exists: true } })).toBe(true);

        expect(vars.match({ objectId: { $null: true } })).toBe(false);
        expect(vars.match({ objectId: { $null: false } })).toBe(true);
        expect(vars.match({ objectIds: { $null: false } })).toBe(false);
        expect(vars.match({ objectIds: { $null: true } })).toBe(true);
        expect(vars.match({ "docType.id": { $null: true } })).toBe(false);
        expect(vars.match({ "docType.idNull": { $null: true } })).toBe(true);
    });

    test("evaluate $eq conditions", () => {
        const vars = new Vars({
            objectId: "123",
            otherId: "${objectId}",
            config: {
                name: { foo: "bar" },
                tags: ["a", "b", "c"]
            }
        });
        expect(vars.match({ objectId: { $eq: "123" } })).toBe(true);
        expect(vars.match({ objectId: { $eq: "456" } })).toBe(false);
        expect(vars.match({ objectId: { $ne: "123" } })).toBe(false);
        expect(vars.match({ objectId: { $ne: "456" } })).toBe(true);

        expect(vars.match({ otherId: { $eq: "123" } })).toBe(true);
        expect(vars.match({ otherId: { $eq: "456" } })).toBe(false);
        expect(vars.match({ otherId: { $ne: "123" } })).toBe(false);
        expect(vars.match({ otherId: { $ne: "456" } })).toBe(true);

        expect(vars.match({ "config": { $eq: { name: { foo: "bar" }, tags: ["a", "b", "c"] } } })).toBe(true);
    });

    test("evaluate $regexp conditions", () => {
        const vars = new Vars({
            expr: "a=2",
        });
        expect(vars.match({ expr: { $regexp: "^.*\\s*=\\s*.*$" } })).toBe(true);
    });

    test("evaluate string compare conditions", () => {
        const vars = new Vars({
            expr: "<tag />",
        });
        expect(vars.match({ expr: { $startsWith: "<" } })).toBe(true);
        expect(vars.match({ expr: { $contains: "tag" } })).toBe(true);
        expect(vars.match({ expr: { $endsWith: "/>" } })).toBe(true);
    });

    test("evaluate $in conditions", () => {
        const vars = new Vars({
            name: "foo",
        });
        expect(vars.match({ name: { $in: ["foo", "bar"] } })).toBe(true);
        expect(vars.match({ name: { $nin: ["hello", "world"] } })).toBe(true);
    });

    test("evaluate $lt, $gt conditions", () => {
        const vars = new Vars({
            value: 5,
        });
        expect(vars.match({ value: { $lt: 6 } })).toBe(true);
        expect(vars.match({ value: { $gt: 4 } })).toBe(true);
        expect(vars.match({ value: { $lte: 5 } })).toBe(true);
        expect(vars.match({ value: { $gte: 5 } })).toBe(true);
    });

    test("evaluate $or conditions", () => {
        const vars = new Vars({
            value: 5,
            name: "foo"
        });
        expect(vars.match({ value: { $or: [{ $lt: 4 }, { $gt: 6 }] } })).toBe(false);
        expect(vars.match({ name: { $or: [{ $eq: "bar" }, { $eq: "foo" }] } })).toBe(true);
        expect(vars.match({ name: { $or: [{ $eq: "bar" }, { $eq: "fooo" }] } })).toBe(false);
    });

    test("evaluate nested conditions", () => {
        const vars = new Vars({
            config: {
                name: "foo",
            },
        });
        expect(vars.match({ "config.name": { $eq: "foo" } })).toBe(true);
    });

});