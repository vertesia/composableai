import { mkdtempSync, rmSync, statSync } from "fs";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { Builder } from "./Builder";
import { loadTarIndex } from "./utils/tar";
import { loadMemoryPack, MEMORY_METADATA_ENTRY } from "./MemoryPack";

const memoryBaseFile = 'test-base-memory.tar';
const memoryFile = 'test-memory.tar';
const tmpdir = mkdtempSync("composable-memory-pack-test-");

afterAll(() => {
    rmSync(memoryBaseFile);
    rmSync(memoryFile);
    rmSync(tmpdir, { recursive: true });
})

describe("Builder", () => {
    test("create base memory pack", async () => {
        const builder = new Builder({
            out: memoryBaseFile,
        });

        await builder.exec(`printf 'file1 from base memory' > ${tmpdir}/file1.txt`);
        const file2 = await builder.exec('printf "file2 from base memory"', { quiet: true });
        builder.copy(`${tmpdir}/file1.txt`, "file1.txt");
        builder.copyText(file2 || '', "file2.txt");
        builder.copyText("file3 from base memory", "file3.txt");

        await builder.build({
            baseProp1: "baseProp1",
            baseProp2: "baseProp2",
            baseProp3: "baseProp3",
        });

        const stats = statSync(memoryBaseFile);
        expect(stats.isFile()).toBeTruthy();
    });

    test("create memory pack override", async () => {
        const builder = new Builder({
            out: memoryFile,
        });

        await builder.from(memoryBaseFile, {
            files: ["!file1.txt"], // remove file1
            projection: {
                baseProp1: false, // remove baseProp1
            }
        })
        // override file2
        builder.copyText(`file2 from new memory`, "file2.txt");
        builder.copyText(`file4 from new memory`, "file4.txt");

        await builder.build({
            baseProp2: "baseProp2", // override baseProp2
            prop4: "prop4",
            parent: { child: 123 }
        });

        const stats = statSync(memoryFile);
        expect(stats.isFile()).toBeTruthy();

        // check the content of the tar

        const memory = await loadMemoryPack(memoryFile);
        const entries = memory.getEntries();
        expect(entries.length).toBe(4);
        expect(entries.map(e => e.name).sort()).toStrictEqual(["file2.txt", "file3.txt", "file4.txt", MEMORY_METADATA_ENTRY].sort());

        const entry1 = memory.getEntry("file1.txt");
        expect(entry1).toBeNull();
        const entry2 = memory.getEntry("file2.txt");
        expect(entry2).not.toBeNull();
        const entry3 = memory.getEntry("file3.txt");
        expect(entry3).not.toBeNull();
        const entry4 = memory.getEntry("file4.txt");
        expect(entry4).not.toBeNull();

        const content2 = (await entry2?.getContent())?.toString("utf-8");
        const content3 = (await entry3?.getContent())?.toString("utf-8");
        const content4 = (await entry4?.getContent())?.toString("utf-8");

        expect(content2).toBe("file2 from new memory");
        expect(content3).toBe("file3 from base memory");
        expect(content4).toBe("file4 from new memory");

        const context = await memory.getMetadata();
        expect(context).toStrictEqual({
            baseProp2: "baseProp2",
            baseProp3: "baseProp3",
            prop4: "prop4",
            parent: { child: 123 }
        });
    })

    test("MemoryPack.exportObject", async () => {
        const memory = await loadMemoryPack(memoryFile);
        let obj = await memory.exportObject({
            "@": "@",
            "file2": "@content:file2.txt",
        });
        expect(obj).toStrictEqual({
            "file2": "file2 from new memory",
            baseProp2: "baseProp2",
            baseProp3: "baseProp3",
            prop4: "prop4",
            parent: { child: 123 }
        })
        obj = await memory.exportObject({
            "prop4": "@prop4",
            "file2": "@content:file2.txt",
            "manifest": "@",
        });
        expect(obj).toStrictEqual({
            prop4: "prop4",
            "file2": "file2 from new memory",
            manifest: {
                baseProp2: "baseProp2",
                baseProp3: "baseProp3",
                prop4: "prop4",
                parent: { child: 123 }
            }
        })
        obj = await memory.exportObject({
            "content": "@content:*.txt",
        });
        expect(obj).toStrictEqual({
            content: [
                "file2 from new memory",
                "file3 from base memory",
                "file4 from new memory"
            ]
        })

        obj = await memory.exportObject({
            "content": "@content:file2.txt,file3.txt",
        });
        expect(obj).toStrictEqual({
            content: [
                "file2 from new memory",
                "file3 from base memory",
            ]
        })

        obj = await memory.exportObject({
            "content": "@content:file2.txt,*4.txt",
        });
        expect(obj).toStrictEqual({
            content: [
                "file2 from new memory",
                "file4 from new memory"
            ]
        })

        obj = await memory.exportObject({
            "files": "@file:*.txt",
        });
        expect(obj).toStrictEqual({
            files: [
                { name: "file2.txt", content: "file2 from new memory" },
                { name: "file3.txt", content: "file3 from base memory" },
                { name: "file4.txt", content: "file4 from new memory" }
            ]
        })

        obj = await memory.exportObject({
            "files": "@file:file2.txt,file3.txt",
        });
        expect(obj).toStrictEqual({
            files: [
                { name: "file2.txt", content: "file2 from new memory" },
                { name: "file3.txt", content: "file3 from base memory" },
            ]
        })

        obj = await memory.exportObject({
            "files": "@file:*2.txt,*4.txt",
        });
        expect(obj).toStrictEqual({
            files: [
                { name: "file2.txt", content: "file2 from new memory" },
                { name: "file4.txt", content: "file4 from new memory" },
            ]
        })

    })

    test("MemoryPack.exportObject with nested props", async () => {
        const memory = await loadMemoryPack(memoryFile);
        const obj = await memory.exportObject({
            "child": "@parent.child",
        });
        expect(obj).toStrictEqual({
            child: 123
        })
    });

    test("MemoryPack.exportObject with runtime values", async () => {
        const memory = await loadMemoryPack(memoryFile);
        const obj = await memory.exportObject({
            "father": "@parent",
            "instruction": "Use this runtime instruction",
            someNullValue: null,
            someObject: { msg: "Hello" }
        });
        expect(obj).toStrictEqual({
            father: { child: 123 },
            "instruction": "Use this runtime instruction",
            someNullValue: null,
            someObject: { msg: "Hello" }
        })
    });

});
