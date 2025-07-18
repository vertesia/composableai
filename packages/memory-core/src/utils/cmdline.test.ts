import { describe, test, expect } from "vitest";
import { splitCommandLine, splitPipeCommands } from "./cmdline";

describe("command line parser", () => {

    test("split command line", () => {
        const args = splitCommandLine("cmd -m \"hello 'world'\" 'some \"file\"' 'nested \"dquote\"' \"nested \'squote\'\"");
        expect(args).toEqual(["cmd", "-m", "hello 'world'", "some \"file\"", 'nested "dquote"', "nested 'squote'"]);

    })

    test("split commands pipeline", () => {
        const pipe = splitPipeCommands("cat \"the file.txt\" | grep \"the\" | wc -c");
        expect(pipe.out).toBeUndefined();
        expect(pipe.commands).toEqual([
            { name: "cat", args: ["the file.txt"] },
            { name: "grep", args: ["the"] },
            { name: "wc", args: ["-c"] }
        ]);
    })

    test("split commands pipeline and redirect output", () => {
        const pipe = splitPipeCommands("cat \"the file.txt\" | grep \"the\" | wc -c > out.txt");
        expect(pipe.out).toBe("out.txt");
        expect(pipe.commands).toEqual([
            { name: "cat", args: ["the file.txt"] },
            { name: "grep", args: ["the"] },
            { name: "wc", args: ["-c"] }
        ]);
    })

});