import {
    indexPage,
    interactionCollectionPage,
    skillCollectionPage,
    toolCollectionPage
} from "@vertesia/tools-sdk";
import { copyFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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

    // Copy scripts first (if they exist)
    try {
        copyDir("./scripts", `${outDir}/scripts`);
        console.log('✓ Copied scripts directory');
    } catch (err) {
        console.log('  No scripts directory to copy');
    }

    // Load interactions
    const interactions = await loadInteractions();

    // Create main index page
    console.log('Creating index page...');
    writeFileSync(
        `${outDir}/index.html`,
        indexPage(tools, skills, interactions, 'Tool Server Template')
    );

    // Create pages for each tool collection
    console.log(`Creating ${tools.length} tool collection pages...`);
    for (const coll of tools) {
        const dir = `${outDir}/tools/${coll.name}`;
        mkdirSync(dir, { recursive: true });
        writeFileSync(
            `${dir}/index.html`,
            toolCollectionPage(coll)
        );
    }

    // Create pages for each skill collection
    console.log(`Creating ${skills.length} skill collection pages...`);
    for (const coll of skills) {
        const dir = `${outDir}/skills/${coll.name}`;
        mkdirSync(dir, { recursive: true });
        writeFileSync(
            `${dir}/index.html`,
            skillCollectionPage(coll)
        );
    }

    // Create pages for each interaction collection
    console.log(`Creating ${interactions.length} interaction collection pages...`);
    for (const coll of interactions) {
        const dir = `${outDir}/interactions/${coll.name}`;
        mkdirSync(dir, { recursive: true });
        writeFileSync(
            `${dir}/index.html`,
            interactionCollectionPage(coll)
        );
    }

    console.log('✓ Static site build complete!');
}

function copyDir(src: string, dest: string) {
    mkdirSync(dest, { recursive: true });
    const entries = readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = join(src, entry.name);
        const destPath = join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else if (entry.isFile()) {
            copyFileSync(srcPath, destPath);
        }
    }
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
