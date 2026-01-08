import {
    indexPage,
    interactionCollectionPage,
    skillCollectionPage,
    toolCollectionPage
} from "@vertesia/tools-sdk";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { glob } from "node:fs/promises";
import { basename } from "node:path";
import { loadInteractions } from "./interactions/index.js";
import { skills } from "./skills/index.js";
import { tools } from "./tools/index.js";

/**
 * Generates static HTML pages for all tool collections, skills, and interactions
 * This runs during the build process to create browsable documentation
 */
async function build(outDir: string) {
    console.log(`Building static site to ${outDir}...`);

    // Ensure output directory exists
    mkdirSync(outDir, { recursive: true });

    // Copy scripts from skill directories
    const scriptCount = await copyScriptsFromSkills(`${outDir}/scripts`);
    if (scriptCount > 0) {
        console.log(`✓ Copied ${scriptCount} script(s) from skill directories`);
    } else {
        console.log('  No scripts found in skill directories');
    }

    // Load interactions
    const interactions = await loadInteractions();

    // Create main index page
    console.log('Creating index page...');
    writeFile(
        `${outDir}/index.html`,
        indexPage(tools, skills, interactions, 'Tool Server Template')
    );

    // Create pages for each tool collection
    console.log(`Creating ${tools.length} tool collection pages...`);
    for (const coll of tools) {
        const dir = `${outDir}/tools/${coll.name}`;
        mkdirSync(dir, { recursive: true });
        writeFile(
            `${dir}/index.html`,
            toolCollectionPage(coll)
        );
    }

    // Create pages for each skill collection
    console.log(`Creating ${skills.length} skill collection pages...`);
    for (const coll of skills) {
        const dir = `${outDir}/skills/${coll.name}`;
        mkdirSync(dir, { recursive: true });
        writeFile(
            `${dir}/index.html`,
            skillCollectionPage(coll)
        );
    }

    // Create pages for each interaction collection
    console.log(`Creating ${interactions.length} interaction collection pages...`);
    for (const coll of interactions) {
        const dir = `${outDir}/interactions/${coll.name}`;
        mkdirSync(dir, { recursive: true });
        writeFile(
            `${dir}/index.html`,
            interactionCollectionPage(coll)
        );
    }

    console.log('✓ Static site build complete!');
}

/**
 * Find and copy all scripts (.js, .py) from skill directories to dist/scripts (flat)
 * Uses glob to find: src/skills/*-slash-*-slash-*.{py,js}
 */
async function copyScriptsFromSkills(outputDir: string): Promise<number> {
    // Ensure output directory exists
    mkdirSync(outputDir, { recursive: true });

    // Find all .py and .js files in skill directories
    const scriptFiles = glob('src/skills/*/*/*.{py,js}');

    // Check for duplicate script names
    const nameMap = new Map<string, string>();
    const filesToCopy: { file: string; name: string }[] = [];

    for await (const file of scriptFiles) {
        const name = basename(file);
        if (nameMap.has(name)) {
            const existing = nameMap.get(name)!;
            throw new Error(
                `Duplicate script name "${name}" found:\n` +
                `  - ${existing}\n` +
                `  - ${file}\n` +
                `Script names must be unique across all skills.`
            );
        }
        nameMap.set(name, file);
        filesToCopy.push({ file, name });
    }

    // Copy all scripts
    for (const { file, name } of filesToCopy) {
        const destPath = `${outputDir}/${name}`;
        copyFileSync(file, destPath);
    }

    return filesToCopy.length;
}

function writeFile(file: string, content: string) {
    writeFileSync(file, content.trim() + '\n', "utf8");
}

// Run the build
const outDir = process.argv[2] || './dist';
build(outDir)
    .then(() => {
        process.exit(0);
    })
    .catch(error => {
        console.error('Build failed:', error);
        process.exit(1);
    });
