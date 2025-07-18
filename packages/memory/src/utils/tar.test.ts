import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { loadTarIndex, TarBuilder, TarIndex } from "./tar";
import { readFileSync, stat, statSync, unlinkSync } from "fs";

const tarFile = `test-${Date.now()}.tar`;
afterAll(() => {
    unlinkSync(tarFile);
});

describe("Indexed tar format", () => {
    const builder = new TarBuilder(tarFile);
    test("build tar", async () => {
        builder.add("file1.txt", Buffer.from("hello world!"));
        builder.add("file2.txt", Buffer.from("bonjour monde!"));
        builder.add("app/package.json", readFileSync("./package.json"));
        await builder.build();
        const stats = statSync(tarFile);
        expect(stats.isFile()).toBeTruthy();
    });

    test("read tar", async () => {
        const index = await loadTarIndex(tarFile) as TarIndex;
        expect(index).toBeDefined();
        expect(Object.keys(index.entries).length).toBe(3);
        const file1 = index.get('file1.txt');
        const file2 = index.get('file2.txt');
        const file3 = index.get('app/package.json');
        expect(file1).toBeDefined();
        expect(file2).toBeDefined();
        expect(file3).toBeDefined();
        expect(file1!.size).toBe(12);
        expect(file2!.size).toBe(14);
        expect(file3!.size).toBeGreaterThan(0);

        const content1 = await index.getContent('file1.txt');
        const content2 = await index.getContent('file2.txt');
        const content3 = await index.getContent('app/package.json');

        expect(content1!.toString()).toBe("hello world!");
        expect(content2!.toString()).toBe("bonjour monde!");
        const pkg = JSON.parse(content3!.toString());
        expect(pkg).toBeDefined();
        expect(pkg).toHaveProperty("name");
        expect(pkg).toHaveProperty("version");
        expect(pkg).toHaveProperty("dependencies");
    });

});