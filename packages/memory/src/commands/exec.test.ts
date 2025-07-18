import { describe, test, expect } from "vitest";
import { exec } from "./exec";
import fs from "fs";;

describe("exec", () => {
    test("test pipe", async () => {
        const output = await exec('echo "hello" | wc -c', { quiet: true });
        expect(output).toBeDefined();
        expect(output!.trim()).toBe("6");
    });
    test("test pipe with redirection", async () => {
        const name = "test-" + Date.now().toString() + ".txt";
        const output = await exec(`echo "hello" | wc -c > ${name}`, { quiet: true });
        try {
            expect(output).toBeUndefined();
            const content = fs.readFileSync(name, 'utf-8').trim();
            expect(content).toBe("6");
        } finally {
            fs.unlinkSync(name);
        }
    });
});