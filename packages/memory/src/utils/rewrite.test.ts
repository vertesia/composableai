import { describe, expect, test } from "vitest";
import { createPathRewrite } from "./rewrite";

describe("Path rewrite", () => {
    test("constant path", () => {
        let fn = createPathRewrite("/root!some/path")
        let r = fn("/root/the/path", 0)
        expect(r).toBe("some/path")

        fn = createPathRewrite("some/path")
        r = fn("/root/the/path", 0)
        expect(r).toBe("some/path")
    })

    test("wildcard path", () => {
        let fn = createPathRewrite("/root!*")
        let r = fn("/root/the/path.ext", 0)
        expect(r).toBe("the/path.ext")

        fn = createPathRewrite("*")
        r = fn("/root/the/path.ext", 0)
        expect(r).toBe("path.ext")
    })

    test("expression path", () => {
        let fn = createPathRewrite("/root!images/%d/file-%n-%i.%e")
        let r = fn("/root/the/path.ext", 0)
        expect(r).toBe("images/the/file-path-0.ext")

        fn = createPathRewrite("images/%d/file-%n-%i.%e")
        r = fn("/root/the/path.ext", 0)
        expect(r).toBe("images/file-path-0.ext")
    })

    test("expression path using %f", () => {
        let fn = createPathRewrite("/root!images/%d/file-%i-%f")
        let r = fn("/root/the/path.ext", 0)
        expect(r).toBe("images/the/file-0-path.ext")

        fn = createPathRewrite("images/%d/file-%i-%f")
        r = fn("/root/the/path.ext", 0)
        expect(r).toBe("images/file-0-path.ext")
    })

    test("expression using wildcard with prefix", () => {
        let fn = createPathRewrite("/root!images/*")
        let r = fn("/root/the/path.ext", 0)
        expect(r).toBe("images/the/path.ext")

        fn = createPathRewrite("images/*")
        r = fn("/root/the/path.ext", 0)
        expect(r).toBe("images/path.ext")
    })

    test("expression using %p", () => {
        let fn = createPathRewrite("/root!images/%p")
        let r = fn("/root/the/path.ext", 0)
        expect(r).toBe("images/the_path.ext")

        fn = createPathRewrite("images/%p")
        r = fn("/root/the/path.ext", 0)
        expect(r).toBe("images/path.ext")
    })

})