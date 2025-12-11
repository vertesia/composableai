import {
    indexPage,
    interactionCollectionPage,
    skillCollectionPage,
    toolCollectionPage
} from "@vertesia/tools-sdk";
import { mkdirSync, writeFileSync } from "node:fs";
import { loadInteractions } from "./interactions/index.js";
import { skills } from "./skills/index.js";
import { tools } from "./tools/index.js";

/**
 * Generates static HTML pages for all tool collections, skills, and interactions
 * This runs during the build process to create browsable documentation
 */
async function build(outDir: string) {
    console.log(`Building static site to ${outDir}...`);

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

// Run the build
const outDir = process.argv[2] || './dist';
build(outDir).catch(error => {
    console.error('Build failed:', error);
    process.exit(1);
});
